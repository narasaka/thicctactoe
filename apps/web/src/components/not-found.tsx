import { Link, useRouter } from "@tanstack/react-router";

import Button, { buttonClass } from "./button";
import Layout from "./layout";

export default function NotFound() {
  const router = useRouter();
  return (
    <Layout className="container">
      <h1 className="text-center text-6xl font-pixel sm:text-7xl">404</h1>
      <h2 className="text-center text-gray-500 sm:text-lg">where u goin?</h2>
      <div className="p-2" />
      <div className="flex flex-col gap-2 px-8 md:flex-row md:justify-center">
        <Link to="/" className={buttonClass({ className: "text-center" })}>
          &larr; Home
        </Link>
        <Button intent="secondary" onClick={() => router.history.back()}>
          &larr; Back
        </Button>
      </div>
    </Layout>
  );
}
