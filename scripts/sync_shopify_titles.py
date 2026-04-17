#!/usr/bin/env python3
"""
One-shot: sincroniza conteudo de produtos Shopify por SKU.

Source: loja alema (read_products)
Dest:   loja inglesa (read_products + write_products)
Match:  primeiro variant.sku de cada produto

Campos sobrescritos no destino com o do source:
  - title
  - descriptionHtml
  - seo.title
  - seo.description
  - options[].name          (ex: "Color" -> "Farbe")
  - options[].values[].name (ex: "Red"   -> "Rot")

Estrutura de variantes/options precisa ser IDENTICA entre as 2 lojas
(mesma quantidade de options na mesma ordem, mesma quantidade de values
por option). Produtos com estrutura divergente sao IGNORADOS e listados
no final do dry-run.

Fluxo de auth (Shopify 2026+): troca client_id + client_secret por
access_token via client credentials grant. Token dura 24h; esse script
e one-shot, entao nao precisa cache.

Uso:
    export SOURCE_SHOP=18b5ie-iq.myshopify.com
    export SOURCE_CLIENT_ID=...
    export SOURCE_CLIENT_SECRET=...
    export DEST_SHOP=kncm81-uw.myshopify.com
    export DEST_CLIENT_ID=...
    export DEST_CLIENT_SECRET=...

    python scripts/sync_shopify_titles.py            # dry-run
    python scripts/sync_shopify_titles.py --apply    # escreve

Dependencias: requests
    pip install requests
"""

import argparse
import os
import sys
import time

import requests

API_VERSION = "2025-10"
PAGE_SIZE = 50


def env(name):
    v = os.environ.get(name)
    if not v:
        sys.exit(f"faltando env var: {name}")
    return v


def get_access_token(shop, client_id, client_secret):
    url = f"https://{shop}/admin/oauth/access_token"
    r = requests.post(
        url,
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=30,
    )
    if r.status_code != 200:
        sys.exit(f"auth falhou em {shop}: {r.status_code} {r.text}")
    return r.json()["access_token"]


def gql(shop, token, query, variables=None):
    url = f"https://{shop}/admin/api/{API_VERSION}/graphql.json"
    for attempt in range(5):
        r = requests.post(
            url,
            json={"query": query, "variables": variables or {}},
            headers={
                "X-Shopify-Access-Token": token,
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        if r.status_code == 429:
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        data = r.json()
        if "errors" in data:
            msg = data["errors"]
            throttled = any(
                e.get("extensions", {}).get("code") == "THROTTLED" for e in msg
            )
            if throttled:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"GraphQL error em {shop}: {msg}")
        cost = data.get("extensions", {}).get("cost", {})
        avail = cost.get("throttleStatus", {}).get("currentlyAvailable", 1000)
        if avail < 200:
            time.sleep(1)
        return data["data"]
    raise RuntimeError(f"GraphQL falhou apos retries em {shop}")


PRODUCTS_QUERY = """
query($cursor: String, $n: Int!) {
  products(first: $n, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      descriptionHtml
      seo { title description }
      options {
        id
        name
        position
        optionValues { id name }
      }
      variants(first: 1) { nodes { sku } }
    }
  }
}
"""


def fetch_products(shop, token):
    cursor = None
    while True:
        data = gql(shop, token, PRODUCTS_QUERY, {"cursor": cursor, "n": PAGE_SIZE})
        page = data["products"]
        for p in page["nodes"]:
            variants = p["variants"]["nodes"]
            sku = (variants[0]["sku"] or "").strip() if variants else ""
            yield {
                "id": p["id"],
                "sku": sku,
                "title": p["title"],
                "descriptionHtml": p["descriptionHtml"] or "",
                "seo": p.get("seo") or {},
                "options": p.get("options") or [],
            }
        if not page["pageInfo"]["hasNextPage"]:
            return
        cursor = page["pageInfo"]["endCursor"]


PRODUCT_UPDATE_MUTATION = """
mutation($input: ProductInput!) {
  productUpdate(input: $input) {
    userErrors { field message }
  }
}
"""

OPTION_UPDATE_MUTATION = """
mutation(
  $productId: ID!,
  $option: OptionUpdateInput!,
  $optionValuesToUpdate: [OptionValueUpdateInput!]
) {
  productOptionUpdate(
    productId: $productId,
    option: $option,
    optionValuesToUpdate: $optionValuesToUpdate
  ) {
    userErrors { field message }
  }
}
"""


def _norm(s):
    return s if (s is not None and s != "") else None


def plan_product_update(src, dst):
    """Build ProductInput for title/descriptionHtml/seo. Returns dict or None."""
    changes = {}
    if src["title"] != dst["title"]:
        changes["title"] = src["title"]
    if src["descriptionHtml"] != dst["descriptionHtml"]:
        changes["descriptionHtml"] = src["descriptionHtml"]

    src_seo = src["seo"] or {}
    dst_seo = dst["seo"] or {}
    seo_input = {}
    if _norm(src_seo.get("title")) != _norm(dst_seo.get("title")):
        seo_input["title"] = src_seo.get("title")
    if _norm(src_seo.get("description")) != _norm(dst_seo.get("description")):
        seo_input["description"] = src_seo.get("description")
    if seo_input:
        changes["seo"] = seo_input

    if not changes:
        return None
    changes["id"] = dst["id"]
    return changes


def plan_option_updates(src, dst):
    """Return (list_of_option_updates, mismatch_reason_or_None)."""
    src_opts = sorted(src["options"], key=lambda o: o["position"])
    dst_opts = sorted(dst["options"], key=lambda o: o["position"])

    if len(src_opts) != len(dst_opts):
        return None, f"qtd options: source={len(src_opts)} dest={len(dst_opts)}"

    for s, d in zip(src_opts, dst_opts):
        if len(s["optionValues"]) != len(d["optionValues"]):
            return None, (
                f"option pos {d['position']} '{d['name']}': "
                f"qtd values source={len(s['optionValues'])} dest={len(d['optionValues'])}"
            )

    updates = []
    for s, d in zip(src_opts, dst_opts):
        option_input = {"id": d["id"]}
        name_changed = s["name"] != d["name"]
        if name_changed:
            option_input["name"] = s["name"]

        values_to_update = []
        for sv, dv in zip(s["optionValues"], d["optionValues"]):
            if sv["name"] != dv["name"]:
                values_to_update.append({"id": dv["id"], "name": sv["name"]})

        if name_changed or values_to_update:
            updates.append(
                {
                    "productId": d["id"],
                    "option": option_input,
                    "optionValuesToUpdate": values_to_update,
                }
            )
    return updates, None


def apply_product_update(shop, token, product_input):
    data = gql(shop, token, PRODUCT_UPDATE_MUTATION, {"input": product_input})
    return data["productUpdate"]["userErrors"]


def apply_option_update(shop, token, payload):
    data = gql(shop, token, OPTION_UPDATE_MUTATION, payload)
    return data["productOptionUpdate"]["userErrors"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--apply", action="store_true", help="escreve (default: dry-run)"
    )
    args = ap.parse_args()

    source = {
        "shop": env("SOURCE_SHOP"),
        "client_id": env("SOURCE_CLIENT_ID"),
        "client_secret": env("SOURCE_CLIENT_SECRET"),
    }
    dest = {
        "shop": env("DEST_SHOP"),
        "client_id": env("DEST_CLIENT_ID"),
        "client_secret": env("DEST_CLIENT_SECRET"),
    }

    print("autenticando nas duas lojas...")
    src_token = get_access_token(**source)
    dst_token = get_access_token(**dest)

    print(f"lendo produtos do source ({source['shop']})...")
    src_by_sku = {}
    collisions = 0
    for p in fetch_products(source["shop"], src_token):
        if not p["sku"]:
            continue
        if p["sku"] in src_by_sku:
            collisions += 1
            continue
        src_by_sku[p["sku"]] = p
    print(f"  {len(src_by_sku)} SKUs unicos no source ({collisions} colisoes ignoradas)")

    print(f"lendo produtos do dest ({dest['shop']})...")
    planned = []
    no_sku = no_match = already_ok = 0
    mismatches = []

    for dst_p in fetch_products(dest["shop"], dst_token):
        if not dst_p["sku"]:
            no_sku += 1
            continue
        src_p = src_by_sku.get(dst_p["sku"])
        if not src_p:
            no_match += 1
            continue

        option_ops, reason = plan_option_updates(src_p, dst_p)
        if reason is not None:
            mismatches.append(
                {"title": dst_p["title"], "sku": dst_p["sku"], "reason": reason}
            )
            continue

        product_input = plan_product_update(src_p, dst_p)

        if not product_input and not option_ops:
            already_ok += 1
            continue

        planned.append(
            {
                "id": dst_p["id"],
                "sku": dst_p["sku"],
                "title_old": dst_p["title"],
                "title_new": src_p["title"],
                "product_input": product_input,
                "option_ops": option_ops,
            }
        )

    print("")
    print("resumo:")
    print(f"  atualizar:               {len(planned)}")
    print(f"  sem SKU no dest:         {no_sku}")
    print(f"  SKU nao existe source:   {no_match}")
    print(f"  tudo ja igual:           {already_ok}")
    print(f"  estrutura divergente:    {len(mismatches)}")

    if mismatches:
        print("\nATENCAO produtos ignorados por estrutura divergente:")
        for m in mismatches:
            print(f"  [{m['sku']}] {m['title']!r} -- {m['reason']}")

    preview = planned[:20]
    if preview:
        print("\nprimeiros 20 pra atualizar:")
        for u in preview:
            bits = []
            if u["product_input"]:
                fields = [k for k in u["product_input"] if k != "id"]
                bits.append("product(" + ",".join(fields) + ")")
            if u["option_ops"]:
                bits.append(f"options×{len(u['option_ops'])}")
            print(
                f"  [{u['sku']}] {u['title_old']!r} -> {u['title_new']!r}  [{', '.join(bits)}]"
            )

    if not args.apply:
        print("\ndry-run. rode de novo com --apply pra escrever.")
        return

    if not planned:
        print("\nnada pra fazer.")
        return

    print(f"\naplicando {len(planned)} produtos...")
    ok = err = 0
    for i, u in enumerate(planned, 1):
        errors_here = []
        if u["product_input"]:
            errors_here += apply_product_update(
                dest["shop"], dst_token, u["product_input"]
            )
        for op in u["option_ops"]:
            errors_here += apply_option_update(dest["shop"], dst_token, op)

        if errors_here:
            print(f"  [{i}/{len(planned)}] ERRO {u['sku']}: {errors_here}")
            err += 1
        else:
            print(f"  [{i}/{len(planned)}] ok  {u['sku']}")
            ok += 1
    print(f"\nfim. {ok} atualizados, {err} erros.")


if __name__ == "__main__":
    main()
