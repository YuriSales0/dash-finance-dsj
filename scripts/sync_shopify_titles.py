#!/usr/bin/env python3
"""
One-shot: sincroniza titulos de produtos Shopify por SKU.

Source: loja alema (read_products)
Dest:   loja inglesa (read_products + write_products)
Match:  primeiro variant.sku de cada produto
Acao:   sobrescreve product.title no destino com o do source

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
PAGE_SIZE = 100


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
            yield {"id": p["id"], "title": p["title"], "sku": sku}
        if not page["pageInfo"]["hasNextPage"]:
            return
        cursor = page["pageInfo"]["endCursor"]


UPDATE_MUTATION = """
mutation($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}
"""


def update_title(shop, token, product_id, new_title):
    data = gql(
        shop,
        token,
        UPDATE_MUTATION,
        {"input": {"id": product_id, "title": new_title}},
    )
    return data["productUpdate"]["userErrors"]


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
    src_collisions = 0
    for p in fetch_products(source["shop"], src_token):
        if not p["sku"]:
            continue
        if p["sku"] in src_by_sku:
            src_collisions += 1
            continue
        src_by_sku[p["sku"]] = p["title"]
    print(f"  {len(src_by_sku)} SKUs unicos no source ({src_collisions} colisoes ignoradas)")

    print(f"lendo produtos do dest ({dest['shop']})...")
    planned = []
    no_sku = no_match = already_ok = 0
    for p in fetch_products(dest["shop"], dst_token):
        if not p["sku"]:
            no_sku += 1
            continue
        new_title = src_by_sku.get(p["sku"])
        if new_title is None:
            no_match += 1
            continue
        if new_title == p["title"]:
            already_ok += 1
            continue
        planned.append(
            {
                "id": p["id"],
                "sku": p["sku"],
                "old": p["title"],
                "new": new_title,
            }
        )

    print("")
    print("resumo:")
    print(f"  atualizar:            {len(planned)}")
    print(f"  sem SKU no dest:      {no_sku}")
    print(f"  SKU nao existe source:{no_match}")
    print(f"  titulo ja igual:      {already_ok}")

    preview = planned[:20]
    if preview:
        print("\nprimeiros 20:")
        for u in preview:
            print(f"  [{u['sku']}] {u['old']!r} -> {u['new']!r}")

    if not args.apply:
        print("\ndry-run. rode de novo com --apply pra escrever.")
        return

    if not planned:
        print("\nnada pra fazer.")
        return

    print(f"\naplicando {len(planned)} updates...")
    ok = err = 0
    for i, u in enumerate(planned, 1):
        errors = update_title(dest["shop"], dst_token, u["id"], u["new"])
        if errors:
            print(f"  [{i}/{len(planned)}] ERRO {u['sku']}: {errors}")
            err += 1
        else:
            print(f"  [{i}/{len(planned)}] ok  {u['sku']}")
        ok += 0 if errors else 1
    print(f"\nfim. {ok} atualizados, {err} erros.")


if __name__ == "__main__":
    main()
