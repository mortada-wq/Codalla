

CREATE TABLE public.api_keys (
    id text NOT NULL,
    user_id text NOT NULL,
    provider text NOT NULL,
    label text NOT NULL,
    key_value text NOT NULL,
    base_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.conversations (
    id text NOT NULL,
    user_id text NOT NULL,
    project_id text,
    title text,
    model_id text NOT NULL,
    provider text NOT NULL,
    total_cost real DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.custom_models (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    model_id text NOT NULL,
    provider text NOT NULL,
    description text,
    context_length integer DEFAULT 8192,
    pricing_prompt real DEFAULT 0,
    pricing_completion real DEFAULT 0,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.messages (
    id text NOT NULL,
    conversation_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    tokens_used integer,
    cost real,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.project_assets (
    id text NOT NULL,
    project_id text NOT NULL,
    user_id text NOT NULL,
    kind text NOT NULL,
    path text NOT NULL,
    source_path text,
    source_mime_type text,
    prompt text,
    model text,
    provider text,
    size_bytes integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.project_memory_notes (
    id text NOT NULL,
    project_id text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.project_success_criteria (
    id text NOT NULL,
    project_id text NOT NULL,
    label text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.projects (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    local_path text NOT NULL,
    git_remote_url text,
    current_branch text DEFAULT 'main'::text,
    description text,
    story text,
    target text,
    last_synced timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sessions (
    token_hash text NOT NULL,
    user_id text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.settings (
    user_id text NOT NULL,
    default_model_id text DEFAULT 'deepseek-ai/DeepSeek-V3'::text NOT NULL,
    default_provider text DEFAULT 'siliconflow'::text NOT NULL,
    theme text DEFAULT 'dark'::text NOT NULL,
    font_size integer DEFAULT 14 NOT NULL,
    tab_size integer DEFAULT 2 NOT NULL,
    word_wrap boolean DEFAULT true NOT NULL,
    minimap boolean DEFAULT false NOT NULL,
    send_context_with_messages boolean DEFAULT true NOT NULL,
    github_token text,
    runpod_endpoint text
);

CREATE TABLE public.usage_log (
    id text NOT NULL,
    user_id text NOT NULL,
    model text NOT NULL,
    provider text NOT NULL,
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0 NOT NULL,
    cost real DEFAULT 0 NOT NULL,
    action text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    avatar_url text,
    bio text,
    github_handle text,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    google_id text
);

CREATE TABLE public.workflows (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    description text,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.custom_models
    ADD CONSTRAINT custom_models_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_memory_notes
    ADD CONSTRAINT project_memory_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_success_criteria
    ADD CONSTRAINT project_success_criteria_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token_hash);

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.usage_log
    ADD CONSTRAINT usage_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.custom_models
    ADD CONSTRAINT custom_models_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_memory_notes
    ADD CONSTRAINT project_memory_notes_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_success_criteria
    ADD CONSTRAINT project_success_criteria_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usage_log
    ADD CONSTRAINT usage_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


