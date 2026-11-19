import Chat from "@/components/chat/chat";
import TopNavigation from "@/components/navigation/top-navigation";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <TopNavigation page="Chat" />
      <Chat
        // A configured voice for English reads answers aloud; otherwise the
        // browser's own voices do.
        speechEngine={getSpeechModelFor(null) ? "server" : "browser"}
      />
    </div>
  );
}
