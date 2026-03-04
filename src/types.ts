export interface NFT {
  id: string;
  name: string;
  collection: string;
  image: string;
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Mythic';
  burnValue: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  image: string;
  cost: number;
  stock: number;
}
