"use client";

import LandingPage from "@/components/LandingPage";
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>DUM RUNNER</title>
        <meta name="description" content="A retro-style grid defense game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <LandingPage />
    </>
  );
}
