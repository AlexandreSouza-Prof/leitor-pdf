import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generateSample() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const pagesData = [
    {
      pageNumber: 1,
      header: 'LITERATURA BRASILEIRA — DOMÍNIO PÚBLICO',
      title: 'A Cartomante',
      subtitle: 'Machado de Assis (1884)',
      sections: [
        {
          heading: 'I. O Encontro',
          paragraphs: [
            'Hamlet observa a Horacio que ha mais cousas no ceu e na terra do que sonha a nossa va filosofia. Era a mesma explicacao que dava a bela Rita ao moco Camilo, numa sexta-feira de novembro de 1869, quando este ria dela, por ter ido na vespera consultar uma cartomante.',
            'A diferenca e que o fazia por outras palavras. Ria, ria, dizia-lhe que os homens nao sabem nada, e que a cartomante adivinhara tudo o que se passava.',
            'A senhora riu-se, e disse-lhe que nao tivesse receio. Ao contrario; ele gostava muito dela, mas estava inquieto por causa de um amigo que andava por perto. Camilo quis saber quem era, mas a mulher nada mais adiantou naquela tarde nublada de outono.'
          ]
        }
      ]
    },
    {
      pageNumber: 2,
      header: 'LITERATURA BRASILEIRA — DOMÍNIO PÚBLICO',
      title: 'A Cartomante',
      subtitle: 'Capítulo II — As Dúvidas de Camilo',
      sections: [
        {
          heading: 'II. A Amizade e o Destino',
          paragraphs: [
            'Camilo nao acreditava em nada. Por que? Nao sabia; nao tinha argumentos; limitava-se a negar tudo o que nao pudesse tocar com as proprias maos. Vilela, ao contrario, era homem grave, austero e dedicado aos seus deveres de magistrado.',
            'A amizade entre ambos nascera ainda nos bancos da escola e atravessara os anos sem qualquer arranhao. Todavia, os caminhos da vida sao misteriosos e muitas vezes cruzam sentimentos inesperados.',
            'Quando as cartas anonimas comecaram a chegar, com frases curtas e ameacadoras, a tranquilidade daquela convivencia desfez-se como nevoa ao sol da manha.'
          ]
        }
      ]
    },
    {
      pageNumber: 3,
      header: 'LITERATURA BRASILEIRA — DOMÍNIO PÚBLICO',
      title: 'A Cartomante',
      subtitle: 'Capítulo III — O Desfecho',
      sections: [
        {
          heading: 'III. O Retrato Humano',
          paragraphs: [
            'Nesta obra-prima, Machado de Assis constroi com precisao psicologica a fragilidade das certezas humanas. Entre a razao e a supersticao, os personagens debatem-se contra forcas que escapam ao seu controle.',
            'O conto encerra-se com uma reflexao memoravel sobre as aparencias e a ironia do destino, caracteristicas que tornaram o autor o maior nome das letras brasileiras.',
            'Este texto pertence ao dominio publico e serve como material autentico para estudos de leitura guiada e sintese vocal.'
          ]
        }
      ]
    }
  ];

  for (const pData of pagesData) {
    const page = doc.addPage([595.28, 841.89]); // A4 Size in points
    const { width, height } = page.getSize();
    let currentY = height - 60;

    // Header top rule
    page.drawText(pData.header, {
      x: 50,
      y: currentY,
      size: 9,
      font: fontBold,
      color: rgb(0.4, 0.45, 0.5)
    });

    currentY -= 35;

    // Title
    page.drawText(pData.title, {
      x: 50,
      y: currentY,
      size: 26,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25)
    });

    currentY -= 20;

    // Subtitle
    page.drawText(pData.subtitle, {
      x: 50,
      y: currentY,
      size: 13,
      font: fontItalic,
      color: rgb(0.35, 0.4, 0.45)
    });

    currentY -= 35;

    // Divider Line
    page.drawLine({
      start: { x: 50, y: currentY },
      end: { x: width - 50, y: currentY },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.9)
    });

    currentY -= 30;

    // Sections and Paragraphs
    for (const section of pData.sections) {
      page.drawText(section.heading, {
        x: 50,
        y: currentY,
        size: 15,
        font: fontBold,
        color: rgb(0.15, 0.2, 0.3)
      });

      currentY -= 25;

      for (const paragraph of section.paragraphs) {
        // Simple word wrap at ~75 characters
        const words = paragraph.split(' ');
        let line = '';
        for (const w of words) {
          if ((line + ' ' + w).length > 70) {
            page.drawText(line, {
              x: 50,
              y: currentY,
              size: 12,
              font: fontRegular,
              color: rgb(0.15, 0.15, 0.15),
              lineHeight: 18
            });
            currentY -= 20;
            line = w;
          } else {
            line = line ? line + ' ' + w : w;
          }
        }
        if (line) {
          page.drawText(line, {
            x: 50,
            y: currentY,
            size: 12,
            font: fontRegular,
            color: rgb(0.15, 0.15, 0.15),
            lineHeight: 18
          });
          currentY -= 30;
        }
      }
    }

    // Footer with Page Number
    page.drawText(`Página ${pData.pageNumber} de ${pagesData.length}`, {
      x: width / 2 - 35,
      y: 40,
      size: 10,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    });
  }

  const pdfBytes = await doc.save();
  const outputPath = path.resolve('public', 'exemplo.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Successfully generated public domain sample PDF at: ${outputPath} (${pdfBytes.length} bytes)`);
}

generateSample().catch(console.error);
