export type Wilaya = { code: number; name: string };
export type Category = { id: string; slug: string; name: string };
export type Plan = {
  id: string;
  name: string;
  price: string;
  durationDays: number;
  maxMembers: number;
  maxProducts: number;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  operation: string;
  condition: string;
  salePrice: string | null;
  rentPrice: string | null;
  wilayaCode: number;
  wilayaName: string;
  visibility: string;
  status: string;
  troopId: string;
  troopName: string;
  createdAt: string;
  images: string[];
};

export type TroopCard = {
  id: string;
  name: string;
  wilayaCode: number;
  wilayaName: string;
  commune: string;
  about: string;
  status: string;
  listingCount: number;
  memberCount: number;
  logo: string | null;
  thumbnail: string | null;
};

export type CatalogQuery = {
  q?: string;
  categoryId?: string;
  wilayaCode?: number;
  operation?: string;
  condition?: string;
  maxPrice?: number;
  limit?: number;
  page?: number;
};

export type Me = {
  userId: string;
  name: string;
  email: string;
  platformRole: string;
  canClaimAdmin: boolean;
  troop: null | {
    id: string;
    name: string;
    wilayaCode: number;
    wilayaName: string;
    commune: string;
    about: string;
    phone: string;
    contactEmail: string;
    logo: string;
    thumbnail: string;
    status: string;
    role: string;
  };
  subscription: null | {
    id: string;
    status: string;
    price: string;
    startsOn: string | null;
    endsOn: string | null;
    maxMembers: number;
    maxProducts: number;
    proof: string;
    adminNote: string;
  };
  counts: { members: number; products: number };
  pendingProof: string | null;
  joinRequest: null | { id: string; troopId: string; troopName: string };
  notifications: { id: string; body: string; isRead: boolean; createdAt: string }[];
};
