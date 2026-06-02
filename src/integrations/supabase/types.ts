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
      companies: {
        Row: {
          created_at: string
          hq_location: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          size: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          hq_location?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          size?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          hq_location?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          size?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      insights: {
        Row: {
          created_at: string
          dossier: Json | null
          error: string | null
          generated_at: string | null
          id: string
          is_current: boolean
          job_id: string
          model: string | null
          status: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          dossier?: Json | null
          error?: string | null
          generated_at?: string | null
          id?: string
          is_current?: boolean
          job_id: string
          model?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          dossier?: Json | null
          error?: string | null
          generated_at?: string | null
          id?: string
          is_current?: boolean
          job_id?: string
          model?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "insights_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          audio_url: string | null
          created_at: string
          debrief: Json | null
          difficulty: string | null
          ended_at: string | null
          id: string
          interview_type: string | null
          job_id: string
          mode: string | null
          persona: Json | null
          started_at: string | null
          status: string | null
          target_duration_minutes: number | null
          transcript: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          debrief?: Json | null
          difficulty?: string | null
          ended_at?: string | null
          id?: string
          interview_type?: string | null
          job_id: string
          mode?: string | null
          persona?: Json | null
          started_at?: string | null
          status?: string | null
          target_duration_minutes?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          debrief?: Json | null
          difficulty?: string | null
          ended_at?: string | null
          id?: string
          interview_type?: string | null
          job_id?: string
          mode?: string | null
          persona?: Json | null
          started_at?: string | null
          status?: string | null
          target_duration_minutes?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          extracted_at: string | null
          id: string
          requirements: string[] | null
          responsibilities: string[] | null
          source_input: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          extracted_at?: string | null
          id?: string
          requirements?: string[] | null
          responsibilities?: string[] | null
          source_input?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          extracted_at?: string | null
          id?: string
          requirements?: string[] | null
          responsibilities?: string[] | null
          source_input?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          domain: Database["public"]["Enums"]["user_domain"] | null
          full_name: string | null
          headline: string | null
          preferred_role_types: string[] | null
          resume_file_url: string | null
          resume_text: string | null
          superpowers: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          domain?: Database["public"]["Enums"]["user_domain"] | null
          full_name?: string | null
          headline?: string | null
          preferred_role_types?: string[] | null
          resume_file_url?: string | null
          resume_text?: string | null
          superpowers?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          domain?: Database["public"]["Enums"]["user_domain"] | null
          full_name?: string | null
          headline?: string | null
          preferred_role_types?: string[] | null
          resume_file_url?: string | null
          resume_text?: string | null
          superpowers?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          brief: string | null
          content: Json | null
          created_at: string
          deliverable_type: string | null
          extracted_brief: Json | null
          id: string
          job_id: string
          last_export_format: string | null
          last_exported_at: string | null
          outline: Json | null
          personal_request: string | null
          research_notes: Json | null
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: string | null
          content?: Json | null
          created_at?: string
          deliverable_type?: string | null
          extracted_brief?: Json | null
          id?: string
          job_id: string
          last_export_format?: string | null
          last_exported_at?: string | null
          outline?: Json | null
          personal_request?: string | null
          research_notes?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: string | null
          content?: Json | null
          created_at?: string
          deliverable_type?: string | null
          extracted_brief?: Json | null
          id?: string
          job_id?: string
          last_export_format?: string | null
          last_exported_at?: string | null
          outline?: Json | null
          personal_request?: string | null
          research_notes?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_artifacts: {
        Row: {
          created_at: string
          file_url: string | null
          format: string
          id: string
          project_id: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          format: string
          id?: string
          project_id: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          file_url?: string | null
          format?: string
          id?: string
          project_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          accent_color: string
          created_at: string
          email_notifications: boolean
          onboarding_completed: boolean
          recording_retention_days: number
          theme: string
          transcript_retention_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          email_notifications?: boolean
          onboarding_completed?: boolean
          recording_retention_days?: number
          theme?: string
          transcript_retention_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          email_notifications?: boolean
          onboarding_completed?: boolean
          recording_retention_days?: number
          theme?: string
          transcript_retention_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status: "prospecting" | "interviewing" | "offer" | "closed"
      user_domain:
        | "engineering"
        | "product"
        | "design"
        | "sales"
        | "marketing"
        | "operations"
        | "customer_success"
        | "data"
        | "finance"
        | "people"
        | "executive"
        | "other"
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
      job_status: ["prospecting", "interviewing", "offer", "closed"],
      user_domain: [
        "engineering",
        "product",
        "design",
        "sales",
        "marketing",
        "operations",
        "customer_success",
        "data",
        "finance",
        "people",
        "executive",
        "other",
      ],
    },
  },
} as const
