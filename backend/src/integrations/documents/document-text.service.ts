import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PDF_PAGES = 40;

const bad = (msg: string) => new BadRequestException(msg);
const tidy = (t: string) =>
    t.replace(/\r/g, '')
        .replace(/^-- \d+ of \d+ --$/gm, '') // separadores de página que agrega pdf-parse
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

/**
 * Saca el texto de un archivo adjunto (rúbrica, enunciado, correo del profesor).
 * Acepta PDF con texto, Word (.docx) y texto plano (.txt / .md). El archivo nunca se guarda: solo su texto.
 * Además de la extensión, se revisa la "firma" del archivo para no confiar en el nombre.
 */
@Injectable()
export class DocumentTextService {
    private readonly log = new Logger(DocumentTextService.name);

    async extract(file: Express.Multer.File): Promise<string> {
        const name = (file.originalname || '').toLowerCase();
        const buf = file.buffer;
        if (!buf?.length) throw bad('El archivo está vacío.');

        let text: string;
        try {
            if (name.endsWith('.pdf')) {
                if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw bad('El archivo no es un PDF válido.');
                text = tidy(await this.pdfText(buf));
                if (text.length < 40) {
                    throw bad('Este PDF no tiene texto que se pueda leer (parece escaneado o una imagen). Copia y pega el contenido en el cuadro de contexto.');
                }
            } else if (name.endsWith('.docx')) {
                if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw bad('El archivo no es un Word (.docx) válido.'); // un .docx es un ZIP: empieza por "PK"
                text = tidy((await mammoth.extractRawText({ buffer: buf })).value);
            } else if (name.endsWith('.doc')) {
                throw bad('Los Word antiguos (.doc) no se pueden leer. Guárdalo como .docx o PDF e inténtalo de nuevo.');
            } else if (name.endsWith('.txt') || name.endsWith('.md')) {
                text = buf.toString('utf8');
                if (text.includes('\u0000')) throw bad('El archivo de texto no es válido.');
                text = tidy(text);
            } else {
                throw bad('Formato no soportado. Adjunta un PDF, un Word (.docx) o un archivo de texto (.txt).');
            }
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw bad('No pudimos leer el archivo. Revisa que no esté dañado ni protegido con contraseña.');
        }
        if (!text) throw bad('No encontramos texto en el archivo.');
        return text;
    }

    // pdf-parse se carga solo cuando llega un PDF: si fallara (p. ej. Node viejo), el resto de la app sigue funcionando
    private async pdfText(buf: Buffer) {
        let PDFParse: typeof import('pdf-parse').PDFParse;
        try {
            ({ PDFParse } = await import('pdf-parse'));
        } catch (e: any) {
            this.log.error(`No se pudo cargar pdf-parse (requiere Node 20.16 o superior): ${e.message}`);
            throw bad('El servidor no puede leer PDF en este momento. Copia y pega el contenido en el cuadro de contexto.');
        }
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        try {
            return (await parser.getText({ first: MAX_PDF_PAGES })).text;
        } finally {
            await parser.destroy();
        }
    }
}
