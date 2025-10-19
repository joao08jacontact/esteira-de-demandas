import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Home, BarChart3, Database, Moon, Sun } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    title: "Esteira de Demandas",
    url: "/",
    icon: Home,
  },
  {
    title: "Dashboard GLPI",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "BI Cadastro",
    url: "/bi-cadastro",
    icon: Database,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">JC</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold">JaContact</h2>
            <p className="text-xs text-muted-foreground">Plataforma de Gestão</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start"
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 mr-2" />
              Modo Claro
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 mr-2" />
              Modo Escuro
            </>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
