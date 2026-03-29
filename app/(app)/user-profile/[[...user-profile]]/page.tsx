import { UserProfile } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function UserProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl justify-center px-4 py-10 sm:px-6">
      <UserProfile
        path="/user-profile"
        routing="path"
        appearance={{
          elements: {
            rootBox: "w-full shadow-none",
            card: "bg-card border border-border shadow-lg rounded-xl",
            headerTitle: "text-foreground",
            headerSubtitle: "text-muted-foreground",
            formFieldLabel: "text-foreground",
            formFieldInput:
              "bg-background border-border text-foreground focus:ring-ring",
            formButtonPrimary:
              "bg-primary text-primary-foreground hover:bg-primary/90",
          },
        }}
      />
    </div>
  );
}
