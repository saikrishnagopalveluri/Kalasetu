// Shared catalogue data model + PPTX/DOCX renderers.
// PDF export stays as a rasterized snapshot of the on-screen template (app/catalogue/page.tsx),
// since it needs to visually match the chosen template exactly. PPTX/DOCX are native, editable
// documents built straight from the same underlying product data instead.

export type CatalogueProduct = {
  id: string
  name: string
  material: string | null
  craftType: string | null
  description: string | null
  craftStory: string | null
  imageUrl: string | null
}

export type CatalogueData = {
  title: string
  businessName: string
  contactLabel: string
  products: CatalogueProduct[]
}

async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function exportCataloguePPTX(data: CatalogueData, filename: string) {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'KS', width: 10, height: 7.5 })
  pptx.layout = 'KS'

  const title = pptx.addSlide()
  title.background = { color: '132A45' }
  title.addText(data.title, { x: 0.6, y: 2.8, w: 8.8, h: 1, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Georgia' })
  title.addText(data.businessName, { x: 0.6, y: 3.7, w: 8.8, h: 0.6, fontSize: 16, color: 'D4A017' })

  for (const p of data.products) {
    const slide = pptx.addSlide()
    slide.background = { color: 'FAF7F0' }
    const imgData = p.imageUrl ? await toBase64(p.imageUrl) : null
    if (imgData) {
      slide.addImage({ data: imgData, x: 0.5, y: 0.5, w: 4, h: 4, sizing: { type: 'cover', w: 4, h: 4 } })
    }
    const textX = imgData ? 4.9 : 0.5
    const textW = imgData ? 4.6 : 9
    slide.addText(p.name, { x: textX, y: 0.5, w: textW, h: 0.6, fontSize: 22, bold: true, color: '132A45', fontFace: 'Georgia' })
    let y = 1.3
    if (p.craftType) { slide.addText(`Craft: ${p.craftType}`, { x: textX, y, w: textW, h: 0.35, fontSize: 12, color: '5C6B7A' }); y += 0.4 }
    if (p.material) { slide.addText(`Material: ${p.material}`, { x: textX, y, w: textW, h: 0.35, fontSize: 12, color: '5C6B7A' }); y += 0.4 }
    const story = p.craftStory || p.description
    if (story) {
      slide.addText(story, { x: textX, y: y + 0.15, w: textW, h: 3, fontSize: 11, color: '132A45', valign: 'top', wrap: true })
    }
  }

  const contact = pptx.addSlide()
  contact.background = { color: '132A45' }
  contact.addText(data.contactLabel, { x: 0.6, y: 3.4, w: 8.8, h: 0.8, fontSize: 18, color: 'FFFFFF' })

  await pptx.writeFile({ fileName: filename })
}

export async function exportCatalogueDOCX(data: CatalogueData, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } = await import('docx')

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: data.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: data.businessName, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
  ]

  for (const p of data.products) {
    children.push(new Paragraph({ text: p.name, heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }))

    if (p.imageUrl) {
      const imgData = await toBase64(p.imageUrl)
      if (imgData) {
        try {
          const bin = Buffer.from(imgData.split(',')[1], 'base64')
          children.push(new Paragraph({
            children: [new ImageRun({ data: bin, transformation: { width: 300, height: 220 }, type: 'png' })],
          }))
        } catch {
          // skip image, continue with text
        }
      }
    }

    const meta = [p.craftType && `Craft: ${p.craftType}`, p.material && `Material: ${p.material}`].filter(Boolean).join('   ·   ')
    if (meta) children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true, color: '5C6B7A' })], spacing: { after: 120 } }))

    const story = p.craftStory || p.description
    if (story) children.push(new Paragraph({ text: story, spacing: { after: 200 } }))
  }

  children.push(new Paragraph({ text: data.contactLabel, alignment: AlignmentType.CENTER, spacing: { before: 400 } }))

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
