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

export const HomeScreens = {
  Home: "HomeScreen",
} as const;

export const MessagesScreens = {
  Messages: "MessagesScreen",
  Threads: "ThreadsScreen",
} as const;

export const ContactScreens = {
  Contact: "ContactScreen",
} as const;

export const SettingsScreens = {
  Settings: "SettingsScreen",
} as const;

export type HomeScreensType = (typeof HomeScreens)[keyof typeof HomeScreens];

export type MessagesScreensType =
  (typeof MessagesScreens)[keyof typeof MessagesScreens];

export type ContactScreensType =
  (typeof ContactScreens)[keyof typeof ContactScreens];

export type SettingsScreensType =
  (typeof SettingsScreens)[keyof typeof SettingsScreens];

export const WidgetScreens = {
  HomeScreens: HomeScreens,
  MessagesScreens: MessagesScreens,
  ContactScreens: ContactScreens,
  SettingsScreens: SettingsScreens,
};

export type WidgetScreenType =
  | HomeScreensType
  | MessagesScreensType
  | ContactScreensType
  | SettingsScreensType;

export const WidgetTabs = {
  Home: "Home",
  Messages: "Messages",
  // Contact: "Contact",
  // Settings: "Settings",
} as const;

export type WidgetTabType = (typeof WidgetTabs)[keyof typeof WidgetTabs];

export const faqs = [
  {
    question: "How do I get started?",
    answer:
      "You can get started by contacting us directly through the AI assistant or the Contact section. Our team will understand your requirements and recommend the right AI solution for your business.",
  },
  {
    question: "What can the AI agent do?",
    answer:
      "Our AI agents can answer customer questions, capture leads, manage support requests, book appointments, and keep conversations running 24/7.",
  },
  {
    question: "Will I be able to see customer conversations?",
    answer:
      "Yes. Every lead, customer message, and support request is available inside your dashboard, making it easy to track and manage interactions.",
  },
  {
    question: "Do I need technical knowledge to use it?",
    answer:
      "No. We handle the setup and integration for you, so you can focus on running your business while the AI handles customer interactions.",
  },
  {
    question: "Can the AI work with my existing website?",
    answer:
      "Yes. Our AI agents can be integrated into most websites and can be customized to match your business, services, and brand voice.",
  },
  {
    question: "What happens when a customer needs human support?",
    answer:
      "The AI can collect the customer's details, create a support request, and notify your team so nothing gets missed.",
  },
  {
    question: "Can the AI book appointments automatically?",
    answer:
      "Yes. The AI can collect customer information, qualify inquiries, and help schedule appointments based on your availability.",
  },
  {
    question: "Is my business data secure?",
    answer:
      "Absolutely. Customer conversations and business data are handled securely using modern security practices and controlled access systems.",
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

export const thinkingPhases = {
  default: [
    "Analyzing your request...",
    "Parsing semantic intent...",
    "Building reasoning context...",
    "Cross-checking related data...",
    "Synthesizing coherent insight...",
    "Formulating response structure...",
    "Finalizing output...",
    "Verifying contextual consistency...",
    "Refining response precision...",
    "Applying adaptive reasoning model...",
    "Reviewing logical flow integrity...",
    "Ensuring alignment with prompt constraints...",
    "Performing final validation...",
  ],

  resume_build: [
    "Starting resume analysis...",
    "Analyzing uploaded resume...",
    "Extracting key skills...",
    "Extracting experience details...",
    "Identifying improvement areas...",
    "Mapping strengths to job role...",
    "Aligning achievements...",
    "Optimizing for ATS reading...",
    "Structuring professional summary...",
    "Enhancing clarity and tone...",
    "Refining section order...",
    "Improving readability...",
    "Balancing layout and design...",
    "Integrating job-specific phrases...",
    "Standardizing bullets and spacing...",
    "Polishing grammar and language...",
    "Ensuring consistent formatting...",
    "Refining tone for target role...",
    "Performing content validation...",
    "Reviewing overall structure...",
    "Adding final touches...",
    "Finalizing resume draft...",
    "Running quality checks...",
    "Resume build complete!",
  ],

  ats_optimization: [
    "Starting ATS optimization...",
    "Reading resume data...",
    "Creating optimized draft...",
    "Structuring for parsing...",
    "Cleaning layout...",
    "Normalizing sections...",
    "Preparing download file...",
    "Scanning keywords...",
    "Matching job terms...",
    "Analyzing keyword score...",
    "Mapping ATS schema...",
    "Optimizing phrasing...",
    "Removing bad formats...",
    "Checking compliance...",
    "Standardizing contact info...",
    "Balancing keyword flow...",
    "Testing ATS parsing...",
    "Running ATS simulation...",
    "Aligning with new models...",
    "Verifying sections...",
    "Adjusting keyword ratio...",
    "Finalizing version...",
    "Generating export file...",
    "Optimization complete!",
  ],
};
