"use client"

import { Card } from "@/components/ui/card"
import { DollarSign, Zap, Trophy } from "lucide-react"

const stats = [
  {
    label: "Money Wasted Today",
    value: "$95,645.00",
    icon: DollarSign,
    color: "from-purple-500 to-pink-500",
    description: "Tracked by the community",
  },
  {
    label: "Mining Phase",
    value: "Active",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    description: "Start earning now",
  },
  {
    label: "Community Rewards",
    value: "Coming Soon",
    icon: Trophy,
    color: "from-pink-500 to-rose-500",
    description: "Quest & challenges",
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden border-2 hover:shadow-xl transition-all hover:scale-105">
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-10`} />
          <div className="p-6 relative">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}
            >
              <stat.icon className="w-7 h-7 text-white" />
            </div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm font-medium mb-1">{stat.label}</div>
            <div className="text-xs text-muted-foreground">{stat.description}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}
