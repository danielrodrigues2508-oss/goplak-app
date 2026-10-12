import JSZip from 'jszip';
// Importe a biblioteca que você já usa no projeto para gerar Excel (ex: exceljs ou xlsx)
import ExcelJS from 'exceljs';

export const COST_PER_UNIT = 11.00; // Preço de custo do ADM: R$ 11,00

export interface DisplayItem {
  id?: string;
  code: string;
  model_color?: string; // 'Azul', 'Preto', etc.
  target_url?: string;
  qr_code_url?: string; // Link direto do SVG/PNG ou imagem
}

/**
 * Divide qualquer array em pedaços de tamanho fixo (chunks)
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Gera um Buffer/Blob XLSX para uma fatia de até 50 displays
 */
async function generateSliceWorkbook(
  items: DisplayItem[],
  sliceIndex: number,
  startGlobalIndex: number
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Lote_${sliceIndex + 1}`);

  // Cabeçalho da gráfica
  worksheet.columns = [
    { header: 'Item (Fatia)', key: 'item_local', width: 14 },
    { header: 'Nº Global', key: 'item_global', width: 14 },
    { header: 'Cor / Modelo', key: 'color', width: 18 },
    { header: 'Código', key: 'code', width: 16 },
    { header: 'Link Redirecionamento', key: 'link', width: 45 },
    { header: 'QR Code (Link Direto)', key: 'qr_link', width: 55 },
  ];

  // Adiciona as linhas numeradas estritamente de 1 a 50 (local)
  items.forEach((item, localIndex) => {
    worksheet.addRow({
      item_local: localIndex + 1, // Sempre de 1 a 50 nesta planilha
      item_global: startGlobalIndex + localIndex + 1, // Ex: 1 a 1000 no total
      color: item.model_color || 'Padrão',
      code: item.code,
      link: `https://www.goplak.com.br/d/${item.code}`,
      qr_link: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.goplak.com.br/d/${item.code}`
    });
  });

  // Estiliza o cabeçalho
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Função principal: Exporta pedidos grandes em fatias de 50 dentro de um arquivo ZIP
 */
export async function exportarLoteEmFatiasZip(
  orderId: string,
  displays: DisplayItem[]
) {
  if (!displays || displays.length === 0) {
    alert('Nenhum display encontrado para exportar.');
    return;
  }

  const zip = new JSZip();
  const chunkSize = 50;
  const chunks = chunkArray(displays, chunkSize);

  // Gera cada fatia de 50 e adiciona dentro do ZIP
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startIndex = i * chunkSize;
    const endIndex = startIndex + chunk.length;
    
    // Nome do arquivo: ex: Lote_01_1a50.xlsx, Lote_02_51a100.xlsx
    const fileName = `Lote_${String(i + 1).padStart(2, '0')}_${startIndex + 1}a${endIndex}.xlsx`;
    
    const excelBlob = await generateSliceWorkbook(chunk, i, startIndex);
    zip.file(fileName, excelBlob);
  }

  // Gera o arquivo .zip final
  const zipContent = await zip.generateAsync({ type: 'blob' });

  // Dispara o download automático no navegador
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipContent);
  link.download = `Pedido_${orderId}_Fatias_Grafica_50un.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
