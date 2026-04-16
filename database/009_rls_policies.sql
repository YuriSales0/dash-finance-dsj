-- 009: Row Level Security Policies
-- Segurança: investidores só veem seus próprios dados

-- Habilitar RLS nas tabelas que investidores acessam
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Investidores: só leem seu próprio registro
CREATE POLICY investors_select_own ON investors
    FOR SELECT USING (auth.uid() = auth_user_id);

-- Investimentos: investidor só vê os seus
CREATE POLICY investments_select_own ON investments
    FOR SELECT USING (
        investor_id IN (SELECT id FROM investors WHERE auth_user_id = auth.uid())
    );

-- Oportunidades: investidores aprovados veem oportunidades abertas/ativas
CREATE POLICY opportunities_select_public ON opportunities
    FOR SELECT USING (
        status IN ('open', 'funded', 'active', 'completed')
        AND EXISTS (
            SELECT 1 FROM investors
            WHERE auth_user_id = auth.uid() AND status = 'approved'
        )
    );

-- Métricas: investidores aprovados veem métricas visíveis
CREATE POLICY metrics_select_visible ON investor_metrics
    FOR SELECT USING (
        visible = TRUE
        AND EXISTS (
            SELECT 1 FROM investors
            WHERE auth_user_id = auth.uid() AND status = 'approved'
        )
    );

-- Operation updates: investidor vê updates das suas operações (se visíveis)
CREATE POLICY op_updates_select_own ON operation_updates
    FOR SELECT USING (
        visible_to_investor = TRUE
        AND opportunity_id IN (
            SELECT opportunity_id FROM investments
            WHERE investor_id IN (SELECT id FROM investors WHERE auth_user_id = auth.uid())
        )
    );

-- Invite codes: público pode verificar se código é válido (apenas leitura do campo active)
CREATE POLICY invites_select_active ON invite_codes
    FOR SELECT USING (active = TRUE AND used_by IS NULL);

-- Service role (admin) bypass: Supabase service key ignora RLS automaticamente
-- Todas as operações de INSERT/UPDATE/DELETE são feitas via service key no backend
