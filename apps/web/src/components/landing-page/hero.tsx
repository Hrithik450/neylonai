"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useSessionView } from "@/components/session-view";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { cn } from "@/lib/utils";

const TEXT_PRIMARY = "#242424";
const TEXT_SECONDARY = "#45413F";

export function Hero() {
  const { user, isAuthenticated } = useSessionView();

  return (
    <section
      id="home"
      style={{ background: "#FFF7F4" }}
      className={cn(
        "flex flex-col overflow-hidden",
        "items-center text-center",
        "px-6 sm:px-10 md:px-20 xl:px-28",
        "pt-13 pb-8 lg:landscape:pb-0",
        "lg:landscape:h-[calc(100svh-64px)]",
      )}
    >
      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-400"
      >
        For small SaaS teams
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08 }}
        className={cn(
          "landing-strong",
          "text-[1.9rem] md:text-[2.2rem] lg:text-[clamp(2rem,4.5vw,54px)]",
          "leading-[1.1]",
          "max-w-150 lg:max-w-190",
        )}
        style={{
          fontWeight: 700,
          letterSpacing: "0.5px",
          color: TEXT_PRIMARY,
        }}
      >
        The AI support team you don&apos;t have to hire.
      </motion.h1>

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
      >
        Neylon gives small SaaS teams full support coverage — answers from your
        docs, engages visitors, and captures leads, no new hires.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24 }}
        style={{ marginTop: 22 }}
        className="flex flex-col sm:flex-row items-center gap-3"
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
        <Link
          href="#product-showcase"
          className="landing-strong inline-flex cursor-pointer items-center justify-center text-[#242424] hover:bg-black/5 transition-colors"
          style={{
            height: 44,
            paddingInline: 20,
            border: "1px solid #242424",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          How it works
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 1, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        style={{ marginTop: 32, maxWidth: 1200 }}
        className="flex w-full justify-center items-end self-center overflow-hidden lg:landscape:flex-1 lg:landscape:min-h-0"
      >
        <Image
          src="/images/office-illustration.png"
          alt="Teams using Neylon AI"
          width={1200}
          height={500}
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="w-full h-auto object-contain object-bottom"
          style={{ maxHeight: "110%" }}
          priority
        />
      </motion.div>
    </section>
  );
}
