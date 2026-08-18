"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useSessionView } from "@/components/session-view";
import { useGoogleAuthHandler } from "@/hooks/use-google-auth-handler";

const GREEN = "#0E3228";

const LINKS = {
  Product: [
    { label: "Features", href: "#product-showcase" },
    { label: "Engagement", href: "#features-overview" },
    { label: "Comparison", href: "#comparison-table" },
  ],
  Company: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Sign in", href: "#home-overview" },
  ],
  Support: [{ label: "Contact", href: "mailto:mhrithik450@gmail.com" }],
};

export function Footer() {
  const { user, isAuthenticated } = useSessionView();
  const { handleLogin } = useGoogleAuthHandler();

  return (
    <footer id="footer" className="px-6 sm:px-10 md:px-20 lg:px-28">
      <div>
        {/* CTA */}
        <div className="text-center py-10 sm:py-14 md:py-16">
          <h2
            className="landing-strong text-3xl md:text-4xl xl:text-5xl leading-tight"
            style={{ color: GREEN }}
          >
            Stop losing visitors you&apos;ve already earned.
          </h2>
          <p className="text-gray-500 text-base mt-4 max-w-sm mx-auto">
            Free to start. Live in minutes.
          </p>

          <div className="mt-7 flex justify-center">
            {user && isAuthenticated ? (
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <GoogleLogin
                shape="pill"
                text="signup_with"
                onSuccess={handleLogin}
                onError={() => {}}
              />
            )}
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 border-t border-black/[0.08] py-8 sm:py-10 md:py-12">
          <div className="col-span-2 md:col-span-1">
            <h3
              className="landing-strong text-lg mb-3"
              style={{ color: GREEN }}
            >
              Neylon AI
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-[220px]">
              Visitor engagement and retention for websites that want more from
              their traffic.
            </p>
          </div>

          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <h3 className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-4">
                {group}
              </h3>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-gray-500 text-sm hover:text-gray-900 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-5 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-black/[0.08] text-gray-400 text-xs">
          <p>© {new Date().getFullYear()} Neylon AI. All rights reserved.</p>
          <p>
            Engineered by{" "}
            <Link
              href="https://github.com/Hrithik450/"
              className="hover:text-gray-700 transition-colors"
              style={{ color: GREEN }}
            >
              Hruthik M
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
