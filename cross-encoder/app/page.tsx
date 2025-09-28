"use client";

import { Encodings } from "@/actions/encoder.types";
import React from "react";

export default function Home() {
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    const fetchEncodings = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/encoder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: [
              "How many people live in Berlin?",
              "How many people live in Berlin?",
            ],
            texts: [
              "Berlin has a population of 3,520,031 registered inhabitants.",
              "New York City is famous for the Metropolitan Museum of Art.",
            ],
          }),
        });

        const data: Encodings = await response.json();
        console.log(data.list);
      } catch (error) {
        console.error(error);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchEncodings();
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">
        Hugging Face Transformers in Next.js
      </h1>
      <p className="text-xl"> {loading ? "Loading...." : "Loaded"}</p>
    </main>
  );
}
