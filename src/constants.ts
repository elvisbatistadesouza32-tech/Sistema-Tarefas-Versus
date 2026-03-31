export const DEFAULT_SECTORS = [
  { id: 'board_comercial', name: 'Comercial', background: 'bg-gradient-to-br from-sky-500 to-blue-700' },
  { id: 'board_staff', name: 'Staff', background: 'bg-gradient-to-br from-fuchsia-600 to-purple-800' },
  { id: 'board_gerencia', name: 'Gerencia', background: 'bg-slate-900' },
  { id: 'board_enfermagem', name: 'Enfermagem', background: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
  { id: 'board_tec_enf', name: 'Tec Enf.', background: 'bg-gradient-to-br from-cyan-600 to-cyan-800' },
  { id: 'board_recepcao', name: 'Recepção', background: 'bg-gradient-to-br from-orange-500 to-orange-700' }
];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
