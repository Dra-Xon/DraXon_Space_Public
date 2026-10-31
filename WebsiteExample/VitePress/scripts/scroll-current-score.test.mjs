import { test } from 'node:test'
import assert from 'node:assert/strict'
import { revealCurrentScore } from '../src/.vitepress/theme/scroll-current-score.js'
function fixture(top, height = 30) {
  const row = {getClientRects:()=>[{}],getBoundingClientRect:()=>({top,bottom:top+height,height})}
  return {querySelector:()=>row,clientHeight:200,clientTop:1,scrollHeight:1000,scrollTop:100,getBoundingClientRect:()=>({top:50})}
}
test('visible current score does not move',()=>{
  const list=fixture(80);assert.equal(revealCurrentScore(list),false);assert.equal(list.scrollTop,100)
})
test('offscreen score moves only to the nearest edge with 8px padding and is clamped',()=>{
  const list=fixture(400);assert.equal(revealCurrentScore(list),true);assert.equal(list.scrollTop,287)
  const near=fixture(230);revealCurrentScore(near);assert.equal(near.scrollTop,117)
  const above=fixture(-500);revealCurrentScore(above);assert.equal(above.scrollTop,0)
  const below=fixture(2000);revealCurrentScore(below);assert.equal(below.scrollTop,800)
})
test('missing current score and collapsed lists do not scroll',()=>{
  assert.equal(revealCurrentScore(null),false)
  const list=fixture(400);list.clientHeight=0;assert.equal(revealCurrentScore(list),false)
})
