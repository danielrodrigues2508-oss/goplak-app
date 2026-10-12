import React, { useState } from 'react';
import { exportarLoteEmFatiasZip, COST_PER_UNIT, DisplayItem } from '../utils/exportGrafica';

export interface OrderItem {
  id?: string;
  quantity: number;
  [key: string]: any;
}

export interface OrderDetailsCardProps {
  order: OrderItem;
  displays: DisplayItem[];
}

export function OrderDetailsCard({ order, displays }: OrderDetailsCardProps) {
  const [exporting, setExporting] = useState(false);

  // Cálculo financeiro ADM:
  const totalCost = (order?.quantity || 0) * COST_PER_UNIT;

  const handleExportZip = async () => {
    try {
      setExporting(true);
      await exportarLoteEmFatiasZip(order?.id || 'LOTE', displays);
    } catch (error) {
      console.error('Erro ao gerar ZIP:', error);
      alert('Falha ao exportar fatias da gráfica.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 border border-zinc-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 text-zinc-900 dark:text-white shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold">Resumo do Pedido #{order?.id}</h3>
        <p className="text-sm text-zinc-500 dark:text-neutral-400">Total de unidades: {order?.quantity}</p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
          Custo de Produção (ADM): R$ {totalCost.toFixed(2)} (R$ {COST_PER_UNIT.toFixed(2)}/un)
        </p>
      </div>

      <div className="flex gap-3">
        {/* Botão de Exportar em Fatias de 50 */}
        <button
          onClick={handleExportZip}
          disabled={exporting}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-medium flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {exporting ? 'Compactando...' : '📦 Exportar em fatias de 50 (.zip)'}
        </button>
      </div>
    </div>
  );
}
