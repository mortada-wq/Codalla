import { useState } from "react"
import { useListUsage, useGetUsageSummary } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"
import { Activity, Cpu, Database, DollarSign, ChevronLeft, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts"

export function UsagePanel() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { data: summary, isLoading: isLoadingSummary } = useGetUsageSummary()
  const { data: listData, isLoading: isListLoading } = useListUsage({ limit, offset: page * limit } as any)

  const chartData = summary?.byModel.map(stat => ({
    name: stat.model,
    provider: stat.provider,
    cost: stat.totalCost,
    tokens: stat.totalTokens,
    requests: stat.requestCount,
  })) || []

  return (
    <div className="space-y-6">
      {/* ── Top stats ────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total cost" value={formatCurrency(summary?.totalCost || 0)} hint="All time" icon={DollarSign} loading={isLoadingSummary} />
        <StatCard label="Today's cost" value={formatCurrency(summary?.todayCost || 0)} hint="Last 24 hours" icon={Activity} loading={isLoadingSummary} />
        <StatCard label="Total tokens" value={formatNumber(summary?.totalTokens || 0)} hint="Prompt + completion" icon={Database} loading={isLoadingSummary} />
        <StatCard label="API requests" value={formatNumber(summary?.totalRequests || 0)} hint="Total calls" icon={Cpu} loading={isLoadingSummary} />
      </div>

      {/* ── Charts ───────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold">Cost by model</CardTitle>
            <CardDescription>Where your spend is going.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {isLoadingSummary ? (
              <Skeleton className="w-full h-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickFormatter={(v) => `$${v}`} />
                  <RechartsTooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    formatter={(v: number) => [formatCurrency(v), 'Cost']}
                  />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                    {chartData.map((_e, i) => (
                      <Cell key={i} fill={`hsl(var(--${['primary','info','success','warning','purple'][i % 5]}))`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold">Tokens by model</CardTitle>
            <CardDescription>Volume of tokens processed per model.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {isLoadingSummary ? (
              <Skeleton className="w-full h-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }} dy={10} />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    formatter={(v: number) => [formatNumber(v), 'Tokens']}
                  />
                  <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                    {chartData.map((_e, i) => (
                      <Cell key={i} fill={`hsl(var(--${['info','purple','success','warning','primary'][i % 5]}))`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent activity table ────────────────────────────── */}
      <Card className="bg-card border-border shadow-none overflow-hidden">
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold">Recent activity</CardTitle>
          <CardDescription>Every AI call, when it happened, and how much it cost.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Time</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Model</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Action</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Tokens (P/C)</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isListLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !listData?.entries || listData.entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-[13px]">
                  No usage yet. Once you start chatting with AI, calls show up here.
                </TableCell>
              </TableRow>
            ) : (
              listData.entries.map((entry) => (
                <TableRow key={entry.id} className="border-border">
                  <TableCell className="font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px]">{entry.model}</span>
                      <Badge variant="outline" className="uppercase font-mono text-[10px] px-1.5 py-0">{entry.provider}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.action ? (
                      <Badge variant="secondary" className="font-mono text-[10px]">{entry.action}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[12px]">
                    {formatNumber(entry.promptTokens)} / {formatNumber(entry.completionTokens)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[12px] text-primary">
                    {formatCurrency(entry.cost)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {listData && listData.total > limit && (
          <div className="px-4 py-3 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-mono">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, listData.total)} of {listData.total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= listData.total}>
                Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({ label, value, hint, icon: Icon, loading }: { label: string; value: string; hint: string; icon: React.ElementType; loading: boolean }) {
  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <>
            <div className="text-2xl font-semibold text-foreground font-mono tracking-tight">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-[13px] text-muted-foreground">
      No data yet.
    </div>
  )
}
