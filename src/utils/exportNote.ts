import html2canvas from 'html2canvas'

export async function exportNoteAsImage(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#F1F3F2',
    scale: Math.min(window.devicePixelRatio, 2),
    useCORS: true,
    logging: false,
  })

  const link = document.createElement('a')
  link.download = `${filename || 'note'}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
