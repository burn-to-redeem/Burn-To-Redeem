import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Wallet, Info, ArrowRight, Check, X, Shield, Zap } from 'lucide-react';
import { NFT, Reward } from './types';

// Mock Data
const MOCK_NFTS: NFT[] = [
  { id: '1', name: 'CYBER_PUNK #001', collection: 'NEON_DISTRICT', image: 'https://picsum.photos/seed/cyber1/400/400', rarity: 'Legendary', burnValue: 500 },
  { id: '2', name: 'VOID_WALKER #442', collection: 'ETHEREAL', image: 'https://picsum.photos/seed/void1/400/400', rarity: 'Rare', burnValue: 150 },
  { id: '3', name: 'GLITCH_SOUL #12', collection: 'DIGITAL_DECAY', image: 'https://picsum.photos/seed/glitch1/400/400', rarity: 'Common', burnValue: 50 },
  { id: '4', name: 'CHROME_HEART #09', collection: 'METAL_WORKS', image: 'https://picsum.photos/seed/chrome1/400/400', rarity: 'Mythic', burnValue: 1200 },
  { id: '5', name: 'DATA_GHOST #88', collection: 'NEON_DISTRICT', image: 'https://picsum.photos/seed/ghost1/400/400', rarity: 'Rare', burnValue: 200 },
  { id: '6', name: 'BIT_CRUSHER #03', collection: 'DIGITAL_DECAY', image: 'https://picsum.photos/seed/crush1/400/400', rarity: 'Common', burnValue: 45 },
];

const MOCK_REWARDS: Reward[] = [
  { id: 'r1', name: 'PHYSICAL_PRINT_V1', description: 'High-quality metallic print of your burned asset.', image: 'https://picsum.photos/seed/print1/400/400', cost: 1000, stock: 50 },
  { id: 'r2', name: 'GENESIS_PASS', description: 'Access to future exclusive drops and events.', image: 'https://picsum.photos/seed/pass1/400/400', cost: 2500, stock: 10 },
  { id: 'r3', name: 'CUSTOM_AVATAR', description: 'A 1/1 custom avatar designed by our studio.', image: 'https://picsum.photos/seed/avatar1/400/400', cost: 5000, stock: 5 },
];

export default function App() {
  const [userNfts, setUserNfts] = useState<NFT[]>(MOCK_NFTS);
  const [balance, setBalance] = useState(0);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [isBurning, setIsBurning] = useState(false);
  const [burnedId, setBurnedId] = useState<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const handleConnect = async () => {
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsConnected(true);
  };

  const handleRedeem = (reward: Reward) => {
    if (balance < reward.cost) return;
    setBalance(prev => prev - reward.cost);
    setRedeemSuccess(reward.name);
    setTimeout(() => setRedeemSuccess(null), 4000);
  };

  const handleBurn = async () => {
    if (!selectedNft) return;
    
    setIsBurning(true);
    // Simulate burn delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setBalance(prev => prev + selectedNft.burnValue);
    setBurnedId(selectedNft.id);
    
    // Remove from collection
    setTimeout(() => {
      setUserNfts(prev => prev.filter(n => n.id !== selectedNft.id));
      setSelectedNft(null);
      setIsBurning(false);
      setBurnedId(null);
    }, 1000);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-white selection:text-black relative overflow-hidden">
      {/* Notifications */}
      <AnimatePresence>
        {redeemSuccess && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6"
          >
            <div className="bg-white text-black p-4 rounded-xl shadow-2xl flex items-center gap-4 border border-black/10">
              <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded-lg">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display font-bold uppercase text-sm">Redemption Successful</div>
                <div className="text-xs font-mono opacity-60">ITEM: {redeemSuccess}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
        <div className="scanline" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-t-0 border-x-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm">
              <Flame className="text-black w-6 h-6" />
            </div>
            <span className="font-display font-bold text-xl tracking-tighter uppercase">Burn to Redeem</span>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-6 text-xs font-mono uppercase tracking-widest text-white/50">
              <a href="#gallery" className="hover:text-white transition-colors">Collection</a>
              <a href="#redeem" className="hover:text-white transition-colors">Rewards</a>
              <a href="#about" className="hover:text-white transition-colors">Protocol</a>
            </div>
            
            {isConnected ? (
              <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="font-mono text-sm font-bold">{balance} <span className="text-white/40">CREDITS</span></span>
                <div className="w-px h-4 bg-white/20" />
                <Wallet className="w-4 h-4" />
                <span className="font-mono text-xs text-white/60">0x71C...4f2</span>
              </div>
            ) : (
              <button 
                onClick={handleConnect}
                className="bg-white text-black px-6 py-2 rounded-full font-display font-bold uppercase text-sm tracking-tighter hover:scale-105 active:scale-95 transition-all"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto relative z-10">
        {/* Hero Section */}
        <section className="mb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-end">
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter uppercase mb-8"
              >
                Burn <br />
                <span className="text-white/20">to</span> <br />
                Redeem
              </motion.h1>
              <p className="text-white/60 max-w-md text-lg leading-relaxed">
                The ultimate protocol for asset transformation. Sacrifice your digital artifacts to unlock physical and meta-exclusive rewards.
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <Shield className="w-5 h-5 text-white/40" />
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">Protocol Status</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-display font-bold">ACTIVE</div>
                    <div className="text-xs font-mono text-white/40">BLOCK_HEIGHT: 19,442,102</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-display font-bold">1.2K</div>
                    <div className="text-xs font-mono text-white/40">TOTAL_BURNED</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Burn Interface */}
        <section id="gallery" className="mb-32">
          {!isConnected ? (
            <div className="glass-panel rounded-3xl p-20 text-center flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-10 h-10 text-white/20" />
              </div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-tighter">Wallet Not Connected</h2>
              <p className="text-white/40 max-w-sm">Please connect your wallet to view your collection and initiate the burn protocol.</p>
              <button 
                onClick={handleConnect}
                className="bg-white text-black px-10 py-4 rounded-xl font-display font-bold uppercase text-lg tracking-tighter hover:scale-105 active:scale-95 transition-all mt-4"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-12">
                <h2 className="font-display text-4xl font-bold uppercase tracking-tighter">Your Collection</h2>
                <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                  <Info className="w-4 h-4" />
                  SELECT AN ASSET TO INITIATE BURN SEQUENCE
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {userNfts.map((nft) => (
                    <motion.div
                      key={nft.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ 
                        opacity: burnedId === nft.id ? 0 : 1, 
                        scale: burnedId === nft.id ? 1.1 : 1,
                        filter: burnedId === nft.id ? 'brightness(2) saturate(0)' : 'none'
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => !isBurning && setSelectedNft(nft)}
                      className={`group relative cursor-pointer rounded-2xl overflow-hidden brutalist-border ${selectedNft?.id === nft.id ? 'border-white ring-2 ring-white/20' : ''}`}
                    >
                      <div className="aspect-square overflow-hidden bg-neutral-900">
                        <img 
                          src={nft.image} 
                          alt={nft.name} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="p-6 bg-black/80 backdrop-blur-sm absolute bottom-0 left-0 right-0 border-t border-white/10">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-display font-bold text-lg leading-none mb-1">{nft.name}</h3>
                            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{nft.collection}</p>
                          </div>
                          <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono uppercase">
                            {nft.rarity}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-white/40" />
                            <span className="font-mono text-sm font-bold">{nft.burnValue} <span className="text-white/40">VAL</span></span>
                          </div>
                          {selectedNft?.id === nft.id && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="bg-white text-black p-1 rounded-full"
                            >
                              <Check className="w-4 h-4" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </section>

        {/* Burn Action Bar */}
        <AnimatePresence>
          {selectedNft && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6"
            >
              <div className="bg-white text-black p-6 rounded-2xl shadow-2xl flex items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={selectedNft.image} alt="" className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <div className="text-xs font-mono uppercase tracking-widest opacity-50">Initiate Burn</div>
                    <div className="text-xl font-display font-black uppercase">{selectedNft.name}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-mono uppercase tracking-widest opacity-50">Receive</div>
                    <div className="text-xl font-mono font-bold">+{selectedNft.burnValue} CREDITS</div>
                  </div>
                  <button
                    onClick={handleBurn}
                    disabled={isBurning}
                    className={`h-16 px-8 rounded-xl font-display font-bold uppercase tracking-tighter text-lg flex items-center gap-3 transition-all ${isBurning ? 'bg-black/10 cursor-not-allowed' : 'bg-black text-white hover:scale-105 active:scale-95'}`}
                  >
                    {isBurning ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        >
                          <Flame className="w-5 h-5" />
                        </motion.div>
                        Burning...
                      </>
                    ) : (
                      <>
                        Confirm Burn
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setSelectedNft(null)}
                    disabled={isBurning}
                    className="w-16 h-16 rounded-xl border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Redeem Section */}
        <section id="redeem" className="mb-32">
          <div className="flex items-center justify-between mb-12">
            <h2 className="font-display text-4xl font-bold uppercase tracking-tighter">Redeemable Rewards</h2>
            <div className="flex items-center gap-2 text-xs font-mono text-white/40">
              <Zap className="w-4 h-4" />
              USE CREDITS TO UNLOCK EXCLUSIVE ITEMS
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {MOCK_REWARDS.map((reward) => (
              <div key={reward.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col">
                <div className="aspect-[4/3] overflow-hidden">
                  <img 
                    src={reward.image} 
                    alt={reward.name} 
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-8 flex-grow flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter leading-none">{reward.name}</h3>
                    <div className="text-xs font-mono text-white/40">STOCK: {reward.stock}</div>
                  </div>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed">
                    {reward.description}
                  </p>
                  <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                    <div className="font-mono text-xl font-bold">
                      {reward.cost} <span className="text-white/40 text-xs">CREDITS</span>
                    </div>
                    <button 
                      onClick={() => handleRedeem(reward)}
                      disabled={balance < reward.cost || !isConnected}
                      className={`px-6 py-3 rounded-xl font-display font-bold uppercase tracking-tighter transition-all ${balance >= reward.cost && isConnected ? 'bg-white text-black hover:scale-105 active:scale-95' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                    >
                      {isConnected ? 'Redeem' : 'Connect Wallet'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer id="about" className="pt-20 border-t border-white/10">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-white flex items-center justify-center rounded-sm">
                  <Flame className="text-black w-5 h-5" />
                </div>
                <span className="font-display font-bold text-lg tracking-tighter uppercase">Burn to Redeem</span>
              </div>
              <p className="text-white/40 max-w-sm text-sm leading-relaxed">
                A decentralized protocol for the permanent destruction of digital assets in exchange for high-value physical and digital utility. Built for the next generation of collectors.
              </p>
            </div>
            <div>
              <h4 className="font-display font-bold uppercase mb-6 text-sm tracking-widest">Resources</h4>
              <ul className="space-y-4 text-sm text-white/40 font-mono uppercase">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Smart Contracts</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security Audit</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-bold uppercase mb-6 text-sm tracking-widest">Connect</h4>
              <ul className="space-y-4 text-sm text-white/40 font-mono uppercase">
                <li><a href="#" className="hover:text-white transition-colors">Twitter / X</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Telegram</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Github</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">
            <div>© 2026 BURN_TO_REDEEM_PROTOCOL. ALL RIGHTS RESERVED.</div>
            <div className="flex gap-8">
              <span>STATUS: OPTIMAL</span>
              <span>LATENCY: 12MS</span>
              <span>NETWORK: MAINNET</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
