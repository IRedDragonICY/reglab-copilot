export interface ReportMetadata {
  reportType?: 'praktikum' | 'kuliah';
  mataPraktikum: string;
  judulPertemuan: string;
  hariTanggalSesi: string;
  nama: string;
  nim: string;
  laboratorium?: string;
  dosen?: string;
  pertemuan?: number;
}

export interface AIReportData {
  pendahuluan?: string;
  preTestAnswers: { q: string; a: string }[];
  postTestAnswers: { q: string; a: string }[];
  stepByStepNarrative: string;
  codeAnalysis: string;
  alatDanBahan?: string[];
  cellAnalyses?: {
    cellIndex?: number;
    imageIndex?: number;
    section: 'implementasi' | 'post_test';
    caption: string;
    explanation: string;
    tableCaption?: string;
  }[];
}

export interface UserImage {
  id: string;
  dataUrl: string;
}