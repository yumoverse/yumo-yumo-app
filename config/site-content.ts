export const siteContent = {
  navigation: {
    logo: "Yumo Yumo",
    menu: [
      { label: "Serious Paper", href: "#serious-paper" },
      { label: "Roadmap", href: "#roadmap" },
      { label: "Tokenomics", href: "#tokenomics" },
    ],
    buttons: {
      login: "Log in",
      connectWallet: "Connect Wallet",
    },
  },
  footer: {
    socials: [
      { name: "X (Twitter)", url: "https://twitter.com/yumoyumo", icon: "x" },
      { name: "Telegram", url: "https://t.me/yumoyumo", icon: "telegram" },
      { name: "Discord", url: "https://discord.gg/yumoyumo", icon: "discord" },
      { name: "TikTok", url: "https://tiktok.com/@yumoyumo", icon: "tiktok" },
    ],
    copyright: "© 2025 Yumo Yumo. All rights reserved.",
  },
  hero: {
    title: "Feed the Yumbie.",
    subtitle: "Turn spending into rewards.",
    description: "Your receipts hide value. Yumbie helps you unlock it.",
    cta: "Upload Receipt",
  },
  about: {
    title: "About Yumo Yumo",
    description:
      "The first Web3 project that gamifies everyday spending through Proof of Expense (PoE). Upload receipts, feed your Yumbie, and earn rewards while having fun!",
  },
  roadmap: [
    {
      quarter: "Q1",
      title: "Journey Begins",
      status: "completed",
      items: ["Smart contracts deployed", "Upload a receipt for a prize!"],
    },
    {
      quarter: "Q2",
      title: "Party Time!",
      status: "in-progress",
      items: ["Free NFTs for early users", "Staking is coming"],
    },
    {
      quarter: "Q3",
      title: "Yumos Get Smarter",
      status: "upcoming",
      items: ["More countries on board", "New partnerships"],
    },
    {
      quarter: "Q4",
      title: "Global Expansion",
      status: "upcoming",
      items: ["Local merchant deals", "NFT marketplace opens"],
    },
  ],
  tokenomics: {
    title: "Token Distribution",
    subtitle: "How Yumo is Shared",
    totalSupply: "Total supply: 99 Billion $YUMO tokens — designed for fun, fairness, and growth",
    distribution: [
      {
        percentage: "70%",
        label: "Proof of Expense (Mining)",
        description: "Earned by users through receipt uploads",
      },
      {
        percentage: "15%",
        label: "Staking & Long-term Incentives",
        description: "Rewards for loyal community members",
      },
      {
        percentage: "10%",
        label: "Fun Rewards (Quests, Galxe, Zealy)",
        description: "Gamification and engagement activities",
      },
      {
        percentage: "5%",
        label: "Genesis (Early Participation)",
        description: "Reserved for early adopters and contributors",
      },
    ],
  },
  papers: {
    funPaper: {
      title: "Fun Paper",
      description: "The playful side of Yumo Yumo - gamification, memes, and community vibes",
      url: "/fun-paper",
    },
    seriousPaper: {
      title: "Serious Paper",
      description: "Technical whitepaper - tokenomics, blockchain architecture, and roadmap",
      url: "/serious-paper",
    },
  },
}
