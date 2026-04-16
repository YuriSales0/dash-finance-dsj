-- 006: Investors
-- Investidores da plataforma SCP

CREATE TABLE investors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    bank_name VARCHAR(100),
    bank_agency VARCHAR(10),
    bank_account VARCHAR(20),
    pix_key VARCHAR(100),
    invite_code VARCHAR(20),
    invited_by INT REFERENCES investors(id),
    auth_user_id UUID UNIQUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    approved_by VARCHAR(50),
    approved_at TIMESTAMPTZ,
    total_invested DECIMAL(15,2) DEFAULT 0,
    total_returned DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investors_status ON investors(status);
CREATE INDEX idx_investors_cpf ON investors(cpf);
CREATE INDEX idx_investors_auth ON investors(auth_user_id);

CREATE TABLE invite_codes (
    code VARCHAR(20) PRIMARY KEY,
    created_by VARCHAR(50),
    used_by INT REFERENCES investors(id),
    used_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invites_active ON invite_codes(active) WHERE active = TRUE;
