import { BiForm } from "@/components/bi/bi-form";
import { BiTable } from "@/components/bi/bi-table";
import { BiCanvas } from "@/components/bi/bi-canvas";
import { useBis } from "@/hooks/use-bis";

export default function BiCadastro() {
  const { bis: bisData, loading: isLoading } = useBis();

  const bisEmAberto = bisData.filter((bi) => bi.status === "em_aberto" && !bi.inativo);
  const bisConcluidos = bisData.filter((bi) => bi.status === "concluido" && !bi.inativo);

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="px-6 py-6">
          <h1 className="text-2xl font-semibold">
            Base de dados Power BI
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          {/* Left Panel - Form */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <BiForm />
          </div>

          {/* Right Panel - Tables */}
          <div className="space-y-8">
            {/* BIs em Aberto */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                BIs em Aberto
              </h2>
              <BiTable
                bis={bisEmAberto}
                isLoading={isLoading}
                type="em_aberto"
              />
            </div>

            {/* BIs Concluídos */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                BIs Concluídos
              </h2>
              <BiTable
                bis={bisConcluidos}
                isLoading={isLoading}
                type="concluido"
              />
            </div>
          </div>
        </div>

        {/* Canvas Section */}
        <div className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">
            Planejamento de BIs
          </h2>
          <BiCanvas />
        </div>
      </main>
    </div>
  );
}
