import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TicketStats } from "@shared/schema";
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { GLPI_STATUS, GLPI_PRIORITY } from "@shared/schema";

interface ChartsSectionProps {
  stats?: TicketStats;
  isLoading: boolean;
}

const STATUS_COLORS = {
  1: "#3b82f6", // blue
  2: "#eab308", // yellow
  3: "#f97316", // orange
  4: "#22c55e", // green
  5: "#6b7280", // gray
  6: "#64748b", // dark gray
};

const PRIORITY_COLORS = {
  1: "#94a3b8",
  2: "#64748b",
  3: "#3b82f6",
  4: "#eab308",
  5: "#f97316",
  6: "#ef4444",
};

export function ChartsSection({ stats, isLoading }: ChartsSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {[...Array(1)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statusData = (stats.byStatus || [])
    .map((item) => ({
      name: GLPI_STATUS[item.status as keyof typeof GLPI_STATUS] || `Status ${item.status}`,
      value: item.count,
      status: item.status,
    }))
    .filter((item) => item.value > 0);

  const priorityData = (stats.byPriority || [])
    .map((item) => ({
      name: GLPI_PRIORITY[item.priority as keyof typeof GLPI_PRIORITY] || `Prioridade ${item.priority}`,
      value: item.count,
      priority: item.priority,
    }))
    .filter((item) => item.value > 0);

  // Timeline comparison data (opened vs closed)
  const timelineComparisonData = stats.timelineComparison?.slice(-30) || []; // Last 30 days

  // Top requesters data
  const topRequestersData = stats.topRequesters?.slice(0, 10) || [];

  // Categories data
  const categoriesData = stats.byCategory?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      {/* Timeline Comparison Chart - Full Width */}
      {timelineComparisonData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tickets Abertos vs Fechados (Últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={timelineComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('pt-BR');
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="opened" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Abertos"
                  dot={{ r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="closed" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Fechados"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tickets por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {priorityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PRIORITY_COLORS[entry.priority as keyof typeof PRIORITY_COLORS] || "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Requesters */}
        {topRequestersData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 10 Solicitantes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topRequestersData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="userName" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        {categoriesData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 10 Categorias</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoriesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="categoryName" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
