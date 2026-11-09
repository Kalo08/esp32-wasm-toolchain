const fs=require('fs');const a=fs.readFileSync(process.argv[2]),b=fs.readFileSync(process.argv[3]);
const inHash=i=>i>=176&&i<208, inTail=i=>i>=300063;
let other=0,hash=0,tail=0;for(let i=0;i<a.length;i++) if(a[i]!==b[i]){ if(inHash(i))hash++; else if(inTail(i))tail++; else other++; }
console.log({elfHashBytes:hash, checksumAndDigestBytes:tail, otherBytes:other});
