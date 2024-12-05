import { createClient } from "@supabase/supabase-js";

declare const SUPABASE_URL: string;
declare const SUPABASE_KEY: string;

interface AuthResponse {
  success: boolean;
  userId?: string;
  error?: string;
}

class AuthWebhookHandler {
  private static instance: AuthWebhookHandler | null = null;
  private readonly supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

  private constructor() {
    this.initialize();
  }

  public static getInstance() {
    if (!AuthWebhookHandler.instance) {
      AuthWebhookHandler.instance = new AuthWebhookHandler();
    }
    return AuthWebhookHandler.instance;
  }

  private initialize() {
    // Listen for auth state changes from Supabase
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        this.notifyParentWindow({
          success: true,
          userId: session?.user?.id,
        });
      } else if (event === "SIGNED_OUT") {
        this.notifyParentWindow({
          success: false,
          error: "User signed out",
        });
      }
    });

    // Handle window close
    window.addEventListener("beforeunload", () => {
      if (!this.supabase.auth.getUser()) {
        this.notifyParentWindow({
          success: false,
          error: "Auth window closed",
        });
      }
    });
  }

  private notifyParentWindow(response: AuthResponse) {
    if (window.opener) {
      window.opener.postMessage(
        {
          type: "auth_response",
          ...response,
        },
        "*"
      ); // In production, replace '*' with actual domain
    }
  }
}

export const authWebhookHandler = AuthWebhookHandler.getInstance();
