export interface NFT {
  id: string;
  name: string;
  collection: string;
  image: string;
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Mythic';
  burnValue: number;
  quantity?: number;
  tokenId?: string;
  contractAddress?: string;
}
