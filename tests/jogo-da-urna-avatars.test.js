import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUser,normalizeGift,normalizeChat,normalizeLike} from '../src/lib/tiktokEventNormalizer.js';
import {createGiftReceiver} from '../public/games/jogo-da-urna/votes.js';
const url='https://example.com/avatar.jpg';
test('foto reconhece formatos atuais e antigos do conector',()=>{
  for(const raw of [
    {profilePictureUrl:url},
    {user:{profilePictureUrl:url}},
    {user:{avatarThumb:{urlList:[url]}}},
    {user:{avatarMedium:{urlList:['',url]}}},
    {user:{avatarLarge:{urlList:[url]}}},
    {user:{avatar_thumb:{url_list:[url]}}},
    {avatarLarge:{urlList:[url]}},
    {userDetails:{profilePictureUrls:[url]}},
    {user:{profilePictureUrl:{},avatarThumb:{urlList:[url]}}}
  ])assert.equal(normalizeUser(raw).profilePictureUrl,url);
  assert.equal(normalizeUser({user:{}}).profilePictureUrl,'');
});
test('foto passa por presentes, comentários e curtidas até o jogo',()=>{
  const raw={giftId:5655,user:{uniqueId:'maria',nickname:'Maria',avatarThumb:{urlList:[url]}}};
  for(const normalize of [normalizeGift,normalizeChat,normalizeLike])assert.equal(normalize(raw).user.profilePictureUrl,url);
  const actions=[];createGiftReceiver(a=>actions.push(a))(normalizeGift(raw));
  assert.equal(actions[0].avatar,url);
});
