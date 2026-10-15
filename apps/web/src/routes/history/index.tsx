import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import { authClient } from "@/lib/auth-client";

/** Your games live on your profile now; old links land there. */
export const Route = createFileRoute("/history/")({
  ssr: false,
  component: HistoryPage,
});

function HistoryPage() {
  const { data: session, isPending } = authClient.useSession();
  if (session) {
    return (
      <Navigate to="/players/$playerId" params={{ playerId: session.user.publicId }} replace />
    );
  }
  return (
    <Layout className="container flex flex-col items-center gap-4 text-center">
      {isPending ? (
        <Loader2 className="animate-spin text-neutral-400" />
      ) : (
        <>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">No games yet</h1>
          <Link to="/play" className={buttonClass()}>
            Play online
          </Link>
        </>
      )}
    </Layout>
  );
}
