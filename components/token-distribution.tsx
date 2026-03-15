"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

const data = [
  { name: "Data Contribution (Proof of Expense)", value: 70, color: "oklch(0.65 0.24 264)" },
  { name: "Staking & Incentives", value: 15, color: "oklch(0.55 0.20 180)" },
  { name: "Fun Rewards", value: 10, color: "oklch(0.70 0.18 120)" },
  { name: "Early Data Contributors", value: 5, color: "oklch(0.60 0.22 300)" },
]

export function TokenDistribution() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Token Distribution</CardTitle>
        <p className="text-sm text-muted-foreground">Total supply: 99 Billion YUMO tokens</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.16 0.01 264)",
                border: "1px solid oklch(0.24 0.01 264)",
                borderRadius: "0.5rem",
                color: "oklch(0.98 0.005 264)",
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
