import { SignIn } from "@clerk/react";
import { useEffect } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="text-4xl mb-2">♟️</div>
          <h1 className="text-2xl font-bold text-foreground">Smart Chess Board</h1>
        </div>
        {/* To update login providers, app branding, or OAuth settings use the Auth
            pane in the workspace toolbar. More information can be found in the Replit docs. */}
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/lobby`}
        />
      </div>
    </div>
  );
}
