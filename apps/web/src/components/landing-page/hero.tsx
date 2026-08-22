"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSessionView } from "@/components/session-view";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { cn } from "@/lib/utils";

// design.md tokens — background inherited from page wrapper (#FFF7F4)
const TEXT_PRIMARY = "#242424";
const TEXT_SECONDARY = "#45413F";

/** Section key for `/` — matched by crawl via element `id`. */
const SECTION_KEY = "home-overview";

export function Hero() {
  const { user, isAuthenticated } = useSessionView();

  return (
    <section
      id={SECTION_KEY}
      style={{ background: "#FFF7F4" }}
      className={cn(
        "flex flex-col overflow-hidden",
        "items-start text-left md:items-center md:text-center",
        "px-6 md:px-0",
        "pt-[52px] pb-8 lg:pb-0",
        "lg:h-[calc(100svh-64px)]",
      )}
    >
      {/* ── Heading ─────────────────────────────────────── */}
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className={cn(
          "landing-strong",
          "md:px-4",
          "text-[1.9rem] md:text-[2.2rem] lg:text-[clamp(2rem,4.5vw,54px)]",
          "leading-[1.1]",
          "max-w-[600px] lg:max-w-[760px]",
        )}
        style={{
          fontWeight: 700,
          letterSpacing: "0.5px",
          color: TEXT_PRIMARY,
        }}
      >
        Know why visitors leave. Engage them sooner.
      </motion.h1>

      {/* ── Subtitle ─────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        style={{
          marginTop: 18,
          fontSize: 15,
          lineHeight: 1.45,
          color: TEXT_SECONDARY,
          maxWidth: 500,
        }}
        className="md:px-4"
      >
        Neylon AI watches visitors in real time, starts conversations at the
        right moment, and turns traffic into engagement.
      </motion.p>

      {/* ── Email / CTA form ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24 }}
        style={{ marginTop: 22 }}
        className="md:px-4"
      >
        {user && isAuthenticated ? (
          <motion.div
            id="hero-dashboard-btn"
            className="inline-flex"
            whileHover={{
              scale: 1.04,
              boxShadow: "0 6px 24px rgba(36,36,36,0.22)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            style={{ borderRadius: 9999 }}
          >
            <Link
              href="/dashboard"
              prefetch={true}
              className="landing-strong inline-flex cursor-pointer items-center gap-2 text-white"
              style={{
                height: 44,
                paddingInline: 20,
                background: TEXT_PRIMARY,
                border: "1px solid #242424",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Go to Dashboard
              <motion.span
                whileHover={{ x: 3 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </Link>
          </motion.div>
        ) : (
          <div className="flex" style={{ width: 290, height: 44 }}>
            <input
              type="email"
              placeholder="Your email"
              aria-label="Your email"
              style={{
                flex: 1,
                paddingInline: 14,
                border: "1px solid #242424",
                borderRight: 0,
                borderRadius: "3px 0 0 3px",
                background: "#FFFFFF",
                fontSize: 12,
                color: TEXT_PRIMARY,
                outline: "none",
              }}
            />
            <GoogleSignInButton
              style={{
                width: 96,
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #242424",
                borderRadius: "0 3px 3px 0",
                background: "#242424",
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Try for free
            </GoogleSignInButton>
          </div>
        )}
      </motion.div>

      {/* ── Illustration ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 1, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        style={{ marginTop: 32, maxWidth: 1200 }}
        className="flex items-end overflow-hidden lg:flex-1 lg:min-h-0 w-full md:w-[68%] lg:w-full"
      >
        <Image
          src="/images/office-illustration.png"
          alt="Teams using Neylon AI"
          width={1200}
          height={500}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 68vw, 1200px"
          className="w-full h-auto object-contain object-bottom"
          style={{ maxHeight: "110%" }}
          priority
        />
      </motion.div>
    </section>
  );
}
