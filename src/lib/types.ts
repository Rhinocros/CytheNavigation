export type Scope = 'internal' | 'external';

export type Group = {
  id: number;
  name: string;
  color: string;
  sort: number;
  visibility: 'public' | 'private';
  owner_id: number | null;
};

export type Link = {
  id: number;
  group_id: number;
  name: string;
  url: string;
  note: string;
  icon: string;
  has_thumb: number;
  scope: Scope;
  sort: number;
  owner_id: number | null;
  created_at: string;
};
