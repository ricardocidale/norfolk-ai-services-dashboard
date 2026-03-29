import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Norfolk AI
          </h1>
          <p className="text-sm text-muted-foreground">
            Services Spend Dashboard
          </p>
        </div>
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              rootBox: "shadow-none",
              card: "bg-card border border-border shadow-lg rounded-xl",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton:
                "bg-secondary text-secondary-foreground border border-border hover:bg-accent",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground",
              formFieldLabel: "text-foreground",
              formFieldInput:
                "bg-background border-border text-foreground focus:ring-ring",
              footerActionLink: "text-primary hover:text-primary/80",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              identityPreviewText: "text-foreground",
              identityPreviewEditButton: "text-primary",
              formFieldInputShowPasswordButton: "text-muted-foreground",
              footer: "hidden",
            },
          }}
        />
      </div>
    </div>
  );
}