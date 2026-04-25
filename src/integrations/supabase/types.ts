export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attestations: {
        Row: {
          attestation_text: string | null
          attested_at: string
          attester_email: string | null
          attester_id: string | null
          attester_name: string
          attester_pubkey: string
          ecdsa_signature: string
          id: string
          is_valid: boolean
          payload_hash: string
          relationship: Database["public"]["Enums"]["attester_relationship"]
          skill_id: string
          skill_owner_id: string
          trust_weight: number
        }
        Insert: {
          attestation_text?: string | null
          attested_at?: string
          attester_email?: string | null
          attester_id?: string | null
          attester_name: string
          attester_pubkey: string
          ecdsa_signature: string
          id?: string
          is_valid?: boolean
          payload_hash: string
          relationship: Database["public"]["Enums"]["attester_relationship"]
          skill_id: string
          skill_owner_id: string
          trust_weight?: number
        }
        Update: {
          attestation_text?: string | null
          attested_at?: string
          attester_email?: string | null
          attester_id?: string | null
          attester_name?: string
          attester_pubkey?: string
          ecdsa_signature?: string
          id?: string
          is_valid?: boolean
          payload_hash?: string
          relationship?: Database["public"]["Enums"]["attester_relationship"]
          skill_id?: string
          skill_owner_id?: string
          trust_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "attestations_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          currency: string | null
          flag_emoji: string | null
          hci_source: string | null
          human_capital_index: number | null
          informal_share_pct: number | null
          informal_source: string | null
          lmic_calibration: number
          min_wage_local: string | null
          min_wage_monthly_usd: number | null
          name: string
          population_millions: number | null
          region: string | null
          unemployment_source: string | null
          wage_source: string | null
          youth_unemployment_pct: number | null
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string | null
          flag_emoji?: string | null
          hci_source?: string | null
          human_capital_index?: number | null
          informal_share_pct?: number | null
          informal_source?: string | null
          lmic_calibration?: number
          min_wage_local?: string | null
          min_wage_monthly_usd?: number | null
          name: string
          population_millions?: number | null
          region?: string | null
          unemployment_source?: string | null
          wage_source?: string | null
          youth_unemployment_pct?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string | null
          flag_emoji?: string | null
          hci_source?: string | null
          human_capital_index?: number | null
          informal_share_pct?: number | null
          informal_source?: string | null
          lmic_calibration?: number
          min_wage_local?: string | null
          min_wage_monthly_usd?: number | null
          name?: string
          population_millions?: number | null
          region?: string | null
          unemployment_source?: string | null
          wage_source?: string | null
          youth_unemployment_pct?: number | null
        }
        Relationships: []
      }
      credential_anchors: {
        Row: {
          anchored_at: string
          id: string
          is_revoked: boolean
          payload: Json
          payload_hash: string
          platform_signature: string
          revoked_at: string | null
          revoked_reason: string | null
          signing_key_id: string
          skill_id: string
          user_id: string
        }
        Insert: {
          anchored_at?: string
          id?: string
          is_revoked?: boolean
          payload: Json
          payload_hash: string
          platform_signature: string
          revoked_at?: string | null
          revoked_reason?: string | null
          signing_key_id: string
          skill_id: string
          user_id: string
        }
        Update: {
          anchored_at?: string
          id?: string
          is_revoked?: boolean
          payload?: Json
          payload_hash?: string
          platform_signature?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          signing_key_id?: string
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_anchors_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      fairness_audits: {
        Row: {
          batch_label: string
          created_at: string
          decisions_count: number
          flagged: boolean
          group_rates: Json
          id: string
          max_deviation: number | null
          overall_approval_rate: number | null
          reviewed_at: string | null
          reviewer_id: string | null
        }
        Insert: {
          batch_label: string
          created_at?: string
          decisions_count: number
          flagged?: boolean
          group_rates: Json
          id?: string
          max_deviation?: number | null
          overall_approval_rate?: number | null
          reviewed_at?: string | null
          reviewer_id?: string | null
        }
        Update: {
          batch_label?: string
          created_at?: string
          decisions_count?: number
          flagged?: boolean
          group_rates?: Json
          id?: string
          max_deviation?: number | null
          overall_approval_rate?: number | null
          reviewed_at?: string | null
          reviewer_id?: string | null
        }
        Relationships: []
      }
      frey_osborne_scores: {
        Row: {
          automation_probability: number
          citation: string
          isco_code: string
          task_cognitive_share: number | null
          task_routine_share: number | null
        }
        Insert: {
          automation_probability: number
          citation?: string
          isco_code: string
          task_cognitive_share?: number | null
          task_routine_share?: number | null
        }
        Update: {
          automation_probability?: number
          citation?: string
          isco_code?: string
          task_cognitive_share?: number | null
          task_routine_share?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "frey_osborne_scores_isco_code_fkey"
            columns: ["isco_code"]
            isOneToOne: true
            referencedRelation: "isco_taxonomy"
            referencedColumns: ["isco_code"]
          },
        ]
      }
      isco_taxonomy: {
        Row: {
          category: Database["public"]["Enums"]["skill_category"] | null
          description: string | null
          esco_code: string | null
          isco_code: string
          major_group_code: string | null
          major_group_title: string | null
          title: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["skill_category"] | null
          description?: string | null
          esco_code?: string | null
          isco_code: string
          major_group_code?: string | null
          major_group_title?: string | null
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["skill_category"] | null
          description?: string | null
          esco_code?: string | null
          isco_code?: string
          major_group_code?: string | null
          major_group_title?: string | null
          title?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          country_code: string | null
          created_at: string
          currency: string | null
          description: string | null
          embedding: string | null
          employer: string | null
          expires_at: string | null
          growth_pct: number | null
          id: string
          is_remote: boolean
          location: string | null
          required_isco_codes: string[]
          required_skills: string[]
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          source: string | null
          source_citation: string | null
          title: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          embedding?: string | null
          employer?: string | null
          expires_at?: string | null
          growth_pct?: number | null
          id?: string
          is_remote?: boolean
          location?: string | null
          required_isco_codes?: string[]
          required_skills?: string[]
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          source?: string | null
          source_citation?: string | null
          title: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          embedding?: string | null
          employer?: string | null
          expires_at?: string | null
          growth_pct?: number | null
          id?: string
          is_remote?: boolean
          location?: string | null
          required_isco_codes?: string[]
          required_skills?: string[]
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          source?: string | null
          source_citation?: string | null
          title?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          country_code: string | null
          description: string | null
          display_name: string
          emoji: string | null
          id: string
          location: string | null
          occupation: string | null
          prefill_text: string
          slug: string
          sort_order: number
        }
        Insert: {
          country_code?: string | null
          description?: string | null
          display_name: string
          emoji?: string | null
          id?: string
          location?: string | null
          occupation?: string | null
          prefill_text: string
          slug: string
          sort_order?: number
        }
        Update: {
          country_code?: string | null
          description?: string | null
          display_name?: string
          emoji?: string | null
          id?: string
          location?: string | null
          occupation?: string | null
          prefill_text?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          id: string
          item_type: string
          raw_text: string | null
          storage_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          id?: string
          item_type: string
          raw_text?: string | null
          storage_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          id?: string
          item_type?: string
          raw_text?: string | null
          storage_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_band: string | null
          country_code: string | null
          created_at: string
          display_name: string | null
          ecdsa_public_key: string | null
          gender: string | null
          id: string
          is_active: boolean
          last_active: string | null
          preferred_language: string
          region: string | null
          updated_at: string
        }
        Insert: {
          age_band?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string | null
          ecdsa_public_key?: string | null
          gender?: string | null
          id: string
          is_active?: boolean
          last_active?: string | null
          preferred_language?: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          age_band?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string | null
          ecdsa_public_key?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          last_active?: string | null
          preferred_language?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          id: number
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          bucket: string
          id?: number
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          id?: number
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          ai_confidence_score: number | null
          assessment_score: number | null
          attestation_count: number
          attestation_weight_sum: number
          category: Database["public"]["Enums"]["skill_category"] | null
          composite_score: number | null
          created_at: string
          embedding: string | null
          esco_code: string | null
          evidence_strength:
            | Database["public"]["Enums"]["evidence_strength"]
            | null
          id: string
          is_verified: boolean
          isco_code: string | null
          market_relevance: string | null
          observations: string | null
          proficiency_level: number | null
          skill_name: string
          updated_at: string
          user_id: string
          years_of_practice: number | null
        }
        Insert: {
          ai_confidence_score?: number | null
          assessment_score?: number | null
          attestation_count?: number
          attestation_weight_sum?: number
          category?: Database["public"]["Enums"]["skill_category"] | null
          composite_score?: number | null
          created_at?: string
          embedding?: string | null
          esco_code?: string | null
          evidence_strength?:
            | Database["public"]["Enums"]["evidence_strength"]
            | null
          id?: string
          is_verified?: boolean
          isco_code?: string | null
          market_relevance?: string | null
          observations?: string | null
          proficiency_level?: number | null
          skill_name: string
          updated_at?: string
          user_id: string
          years_of_practice?: number | null
        }
        Update: {
          ai_confidence_score?: number | null
          assessment_score?: number | null
          attestation_count?: number
          attestation_weight_sum?: number
          category?: Database["public"]["Enums"]["skill_category"] | null
          composite_score?: number | null
          created_at?: string
          embedding?: string | null
          esco_code?: string | null
          evidence_strength?:
            | Database["public"]["Enums"]["evidence_strength"]
            | null
          id?: string
          is_verified?: boolean
          isco_code?: string | null
          market_relevance?: string | null
          observations?: string | null
          proficiency_level?: number | null
          skill_name?: string
          updated_at?: string
          user_id?: string
          years_of_practice?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wittgenstein_projections: {
        Row: {
          citation: string
          country_code: string | null
          id: string
          no_schooling_pct: number | null
          primary_pct: number | null
          region: string
          scenario: string
          secondary_pct: number | null
          tertiary_pct: number | null
          year: number
        }
        Insert: {
          citation?: string
          country_code?: string | null
          id?: string
          no_schooling_pct?: number | null
          primary_pct?: number | null
          region: string
          scenario?: string
          secondary_pct?: number | null
          tertiary_pct?: number | null
          year: number
        }
        Update: {
          citation?: string
          country_code?: string | null
          id?: string
          no_schooling_pct?: number | null
          primary_pct?: number | null
          region?: string
          scenario?: string
          secondary_pct?: number | null
          tertiary_pct?: number | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "attestor" | "user"
      attester_relationship:
        | "employer"
        | "teacher"
        | "colleague"
        | "client"
        | "community_leader"
        | "peer"
      evidence_strength: "weak" | "moderate" | "strong" | "exceptional"
      skill_category:
        | "technical"
        | "creative"
        | "trade"
        | "business"
        | "interpersonal"
        | "digital"
        | "agriculture"
        | "service"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "attestor", "user"],
      attester_relationship: [
        "employer",
        "teacher",
        "colleague",
        "client",
        "community_leader",
        "peer",
      ],
      evidence_strength: ["weak", "moderate", "strong", "exceptional"],
      skill_category: [
        "technical",
        "creative",
        "trade",
        "business",
        "interpersonal",
        "digital",
        "agriculture",
        "service",
      ],
    },
  },
} as const
