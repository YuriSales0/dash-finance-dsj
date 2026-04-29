-- 019: Liberar acesso admin (DSJ + service_role) para tabelas
-- Cole no Supabase SQL Editor

-- service_role ja bypassa RLS por padrao, mas adicionamos policies explicitas
-- para usuarios autenticados com role 'dsj' tambem

-- RECEIVABLES
DROP POLICY IF EXISTS receivables_dsj_all ON receivables;
CREATE POLICY receivables_dsj_all ON receivables
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

-- DEBTS
DROP POLICY IF EXISTS debts_dsj_all ON debts;
CREATE POLICY debts_dsj_all ON debts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

-- FINANCINGS - admin DSJ pode tudo
DROP POLICY IF EXISTS financings_dsj_all ON financings;
CREATE POLICY financings_dsj_all ON financings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

-- INVESTORS - admin DSJ pode tudo
DROP POLICY IF EXISTS investors_dsj_all ON investors;
CREATE POLICY investors_dsj_all ON investors
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

-- INVITE CODES - admin DSJ pode tudo
DROP POLICY IF EXISTS invite_codes_dsj_all ON invite_codes;
CREATE POLICY invite_codes_dsj_all ON invite_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

-- INVESTOR METRICS
DROP POLICY IF EXISTS metrics_dsj_all ON investor_metrics;
CREATE POLICY metrics_dsj_all ON investor_metrics
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );
