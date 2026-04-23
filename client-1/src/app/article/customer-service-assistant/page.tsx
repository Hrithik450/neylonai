"use client";

import CustomerServiceAssistantImage from "@/assets/images/articles/customer-service-assistant.png";
import Image, { StaticImageData } from "next/image";
import { guminertRegular } from "@/assets/fonts";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import React from "react";
import {
  TabType,
  AssistantKey,
  useUserStore,
  RoleAssistantMap,
  useNavigationStore,
  useErrorStore,
  useSupportWidgetToggleStore,
} from "@/store/store";

interface ArticlePost {
  title: string;
  description: string;
  date: string;
  image: string | StaticImageData;
  sections: {
    heading?: string;
    content: string;
    quote?: string;
    points?: string[];
  }[];
}

const articlePost: ArticlePost = {
  title:
    "Use this article to interact with the Customer Service Assistant and experience real-time support.",
  description: "",
  date: "October 26, 2025",
  image: CustomerServiceAssistantImage,
  sections: [
    {
      heading: "The Future of Customer Support is Here",
      content:
        "Customer expectations are higher than ever. Businesses are expected to provide instant responses, personalized experiences, and 24/7 availability — all while managing costs. Traditional support models simply can’t keep up with this demand. That’s where AI-powered customer service agents come in.",
      quote:
        "Smart automation doesn’t replace your team — it empowers them to do more, faster, and better.",
    },
    {
      heading: "Meet Neylon-AI’s Customer Service Agent",
      content:
        "Neylon-AI’s Customer Service AI Agent is designed for modern businesses that value speed, accuracy, and customer satisfaction. It combines intelligent automation with human-like interaction to deliver real-time assistance through a simple, user-friendly widget placed at the bottom-right corner of your website.",
      points: [
        "💬 Offers instant AI-driven support through a clean, interactive chat widget.",
        "📚 Provides personalized answers using your company’s internal knowledge base.",
        "📅 Allows customers to book appointments or demos directly from the chat.",
      ],
    },
    {
      heading: "Why Businesses Are Adopting AI Support",
      content:
        "Across industries — from eCommerce and SaaS to education and real estate — organizations are turning to AI for scalable support. A well-trained AI agent reduces ticket volume, improves response time, and ensures consistent service quality across all hours.",
      points: [
        "⏱️ 90% faster initial response time compared to traditional systems.",
        "📈 40% improvement in customer retention through proactive assistance.",
        "💡 Seamless handoff to human agents when complex queries arise.",
      ],
    },
    {
      heading: "How It Works",
      content:
        "The Support Agent appears as an 'Ask AI' button. When users click it, they’re greeted with a dynamic interface featuring three tabs — Home, Messages, and Contact. It’s built to guide your customers from curiosity to resolution effortlessly.",
      points: [
        "🏠 Home Tab: Displays latest insights, FAQs, and a quick 'Ask a Question' button.",
        "💬 Messages Tab: Shows conversation history and AI responses in real time.",
        "📞 Contact Tab: Lets users book appointments or request technical or collaboration support.",
      ],
    },
    {
      heading: "Seamless Integration with Your Business",
      content:
        "Neylon-AI integrates smoothly with your existing infrastructure — whether you use CRM systems, ERPs, or internal dashboards. It supports REST APIs, Webhooks, and custom front-end dashboards, making deployment simple and fast.",
      points: [
        "🔌 Connects easily with your existing business tools.",
        "⚙️ REST & Webhook integration ensures flexibility.",
        "📊 Custom analytics dashboards for tracking engagement and response rates.",
      ],
    },
    {
      heading: "Built for Security and Reliability",
      content:
        "We understand how critical customer data is. Neylon-AI uses enterprise-grade encryption, GDPR compliance, and role-based access control to ensure every interaction remains private and secure.",
      quote:
        "Trust is the foundation of great customer experiences — our AI is built with that philosophy in mind.",
    },
    {
      heading: "Getting Started is Simple",
      content:
        "You don’t need a technical team to launch. Our onboarding process takes you from discovery to deployment in days, not weeks. Just share your requirements, and we’ll tailor the agent to your business needs.",
      points: [
        "1️⃣ Requirement Discovery & Data Collection",
        "2️⃣ Prototype & Proof of Concept",
        "3️⃣ Integration & Testing",
        "4️⃣ Deployment & Ongoing Optimization",
      ],
    },
    {
      heading: "Why Choose Neylon-AI",
      content:
        "Unlike generic chatbot platforms, Neylon-AI delivers a truly adaptive AI ecosystem that learns from your interactions and grows with your business. From automation to analytics, it’s a complete customer engagement platform — not just a chatbot.",
      points: [
        "🤝 Human-in-the-loop agents for personalization.",
        "🧠 Multi-agent orchestration for enterprise workflows.",
        "☁️ Cloud-native architecture with 99.9% uptime.",
      ],
    },
    {
      heading: "See It in Action",
      content:
        "Want to experience it yourself? Visit the live demo at Neylon-AI and try chatting with the Customer Service Agent. You’ll see how it greets, answers, and guides you — just like it would for your customers.",
      quote:
        "Your customers deserve instant, intelligent support — and your team deserves the tools to make it happen.",
    },
    {
      heading: "Ready to Elevate Your Support Experience?",
      content:
        "Whether you run a startup or a global enterprise, Neylon-AI can help you transform your customer support into a competitive advantage. Schedule a demo today — and experience what AI-powered service feels like.",
      points: [
        "🌐 Website: https://neylonai.vercel.app",
        "✉️ Email: mhrithik450@gmail.com",
        "💼 LinkedIn: https://www.linkedin.com/in/hruthik-m-3595a0329/",
      ],
    },
  ],
};

export default function CustomerServiceAssistantBlog() {
  const pageAssistant = "customer_service_assistant";
  const { isOpen, setIsOpen } = useSupportWidgetToggleStore();
  const { setMessage, setStatus } = useErrorStore();
  const { switchTab } = useNavigationStore();
  const { role, assistant } = useUserStore();
  const router = useRouter();

  React.useEffect(() => {
    setTimeout(() => {
      if (!isOpen) setIsOpen(true);
    }, 500);
  }, []);

  React.useEffect(() => {
    if (!role || !pageAssistant) return;

    const allowedAssistants = RoleAssistantMap[role] ?? [];

    // If role doesn't permit this assistant
    if (!allowedAssistants.includes(pageAssistant as AssistantKey)) {
      setStatus("error");
      setMessage(
        "Please change your role to Business Owner to access this article."
      );
      switchTab(TabType.Settings);
      return router.push("/");
    }

    // If selected assistant doesn't match the page assistant
    if (assistant !== pageAssistant) {
      setStatus("error");
      setMessage(
        "Please select the Customer Service Assistant to access this article."
      );
      switchTab(TabType.Settings);
      return router.push("/");
    }
  }, [role, assistant, pageAssistant, router]);

  return (
    <section
      className={cn(
        "relative max-w-480 mx-auto pt-24 md:pt-30 pb-4 md:pb-10 md:px-14 flex justify-start items-start bg-gray-50 text-gray-800",
        guminertRegular.className
      )}
    >
      <div className="max-w-5xl w-full p-6 md:p-10 space-y-6 overflow-hidden">
        <div className="w-full flex flex-col items-start gap-1">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-snug">
            {articlePost.title}
          </h1>

          <h3 className="px-2 text-md text-gray-500">
            {articlePost.description}
          </h3>
          <p className="px-2 text-left text-black./90 text-md md:text-lg">
            <strong>Last Updated:</strong> {articlePost.date}
          </p>
        </div>

        <div>
          <Image
            width={1919}
            height={910}
            alt="customer-service-assistant"
            src={articlePost.image}
            className="w-full rounded-xl object-cover shadow-md"
          />
        </div>

        <div className="space-y-10">
          {articlePost.sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              {section.heading && (
                <h2 className="text-2xl pl-3 font-semibold text-black border-l-4 border-black">
                  {section.heading}
                </h2>
              )}
              <p className="text-gray-700 leading-relaxed text-md md:text-base">
                {section.content}
              </p>

              {section.quote && (
                <blockquote className="text-md md:text-base border-l-4 border-black/60 pl-4 italic text-gray-600 bg-black/10 rounded-md py-3 px-4">
                  “{section.quote}”
                </blockquote>
              )}

              {section.points && section.points.length > 0 && (
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {section.points.map((point, i) => (
                    <li
                      key={i}
                      className="leading-relaxed text-md md:text-base"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 md:mt-12 text-center border-t border-gray-200">
          <p className="text-md md:text-base text-gray-500">
            Thanks for reading. Stay curious, stay inspired ✨
          </p>
        </div>
      </div>
    </section>
  );
}
