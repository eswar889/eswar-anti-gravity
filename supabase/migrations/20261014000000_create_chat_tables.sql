-- ==============================================================================
-- Supabase Migration: Create Chat Sessions & Messages Tables
-- Migration ID: 20261014000000_create_chat_tables.sql
-- ==============================================================================

-- 1. Create chat_sessions Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Chat',
    model TEXT DEFAULT 'gemini-3.5-flash',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create chat_messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON public.chat_sessions(updated_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Create Idempotent Security Policies (Drop if exists then re-create)
DROP POLICY IF EXISTS "Allow public read access to chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow public read access to chat_sessions"
    ON public.chat_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access to chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow public insert access to chat_sessions"
    ON public.chat_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow public update access to chat_sessions"
    ON public.chat_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow public delete access to chat_sessions"
    ON public.chat_sessions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read access to chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public read access to chat_messages"
    ON public.chat_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access to chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public insert access to chat_messages"
    ON public.chat_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete access to chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public delete access to chat_messages"
    ON public.chat_messages FOR DELETE USING (true);
