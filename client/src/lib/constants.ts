import {
  Bot,
  Cpu,
  Sparkles,
  CircuitBoard,
  Brain,
  Workflow,
  Binary,
  Gauge,
  Atom,
  MessageSquare,
} from "lucide-react";

import { NavItem, Policy } from "@/lib/types";

export const NavItems: NavItem[] = [
  { name: "Home", route: "/" },
  { name: "About Us", route: "/about" },
  { name: "Services", route: "/services" },
  { name: "Publications", route: "/publications" },
  { name: "RISE Conference", route: "/events" },
  { name: "CODE Scientific Consulting", route: "/code" },
];

export const policies: Policy[] = [
  { route: "/about", name: "About us" },
  { route: "/", name: "Privacy Policy" },
  { route: "/", name: "User Terms" },
  { route: "/#contactUs", name: "Help Centre" },
];

export const faqs = [
  {
    question: "How quickly can I get started?",
    answer:
      "So depending on your requirements, you can start seeing results within days. To begin right away, just tell our assistant — 'Book my appointment' — and it will schedule everything for you instantly.",
  },
  {
    question: "What services does AI Solutionz provide?",
    answer:
      "We specialize in building scalable AI solutions, from chatbots and multi-agent systems to workflow automation and data-driven insights.",
  },
  {
    question: "How can AI Solutionz help my business grow?",
    answer:
      "Our AI systems improve accuracy, reliability, automate repetitive tasks, and provide actionable insights, helping you scale faster with reduced costs.",
  },
  {
    question: "Do I need technical expertise to use your solutions?",
    answer:
      "Not at all. We design our platforms to be simple and user-friendly. Our team handles the complexity so you can focus on your business.",
  },
  {
    question: "Can your AI integrate with my existing tools?",
    answer:
      "Yes, our solutions are built to integrate seamlessly with CRMs, ERPs, email systems, and other business software you already use.",
  },
  {
    question: "Is my data safe with AI Solutionz?",
    answer:
      "Absolutely. We follow enterprise-grade security practices, encryption, and compliance standards to ensure your data remains secure and private.",
  },
];

export const robotIcons = [
  Bot,
  Cpu,
  Sparkles,
  CircuitBoard,
  Brain,
  Workflow,
  Binary,
  Gauge,
  Atom,
  MessageSquare,
];
