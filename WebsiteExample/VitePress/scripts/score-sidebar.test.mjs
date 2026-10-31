import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortScoreSidebar } from '../src/.vitepress/score-sidebar.mjs'
const records = [
  {title:'A',link:'/a',difficulty:'Hard',constant:10,totalNotes:100,bpm:200},
  {title:'A',link:'/b',difficulty:'Easy',constant:10,totalNotes:200,bpm:100},
  {title:'B',link:'/c',difficulty:'Hard',constant:11,totalNotes:200,bpm:180}
]
test('level sorting handles plus levels and keeps missing levels last with descending note ties', () => {
  const scores = [
    { title: 'Ten', link: '/ten', level: 'Lv.10', totalNotes: 100 },
    { title: 'Plus', link: '/plus', level: 'Lv.10+', totalNotes: 50 },
    { title: 'Plus many', link: '/plus-many', level: '10＋', totalNotes: 200 },
    { title: 'Eleven', link: '/eleven', level: 'Lv.11', totalNotes: 0 },
    { title: 'Missing', link: '/missing', level: '/', totalNotes: 999 },
    { title: 'Absent', link: '/absent', totalNotes: 1000 }
  ]
  assert.deepEqual(sortScoreSidebar(scores, 'level').map(item => item.link), ['/eleven', '/plus-many', '/plus', '/ten', '/absent', '/missing'])
  assert.deepEqual(sortScoreSidebar(scores, 'level', true).map(item => item.link), ['/ten', '/plus-many', '/plus', '/eleven', '/absent', '/missing'])
})
test('numeric modes flatten difficulties and reverse both sorting keys', () => {
  for (const [mode, expected] of [['constant',['/c','/b','/a']],['total',['/c','/b','/a']],['bpm',['/a','/c','/b']]]) {
    const sorted = sortScoreSidebar(records,mode)
    assert.deepEqual(sorted.map(item=>item.link),expected)
    assert.ok(sorted.every(item=>!item.items && item.text === records.find(record=>record.link === item.link).title))
    assert.deepEqual(sortScoreSidebar(records,mode,true).map(item=>item.link),[...expected].reverse())
  }
})
test('title reverse changes outer groups while preserving difficulty ordering', () => {
  const normal = sortScoreSidebar(records)
  assert.equal(normal.length,2)
  assert.deepEqual(normal[0].items.map(item=>item.link),['/b','/a'])
  const reverse = sortScoreSidebar(records,'title',true)
  assert.equal(reverse[0].text,'B')
  assert.deepEqual(reverse[1].items.map(item=>item.link),['/b','/a'])
})
test('missing constants lead descending order by level and reverse together', () => {
  const scores = [
    {title:'Known',link:'/known',constant:16,totalNotes:9999,level:'Lv.16'},
    ...['Lv.17','Lv.18','Lv.17+','Lv.18+'].map((level,index)=>({title:level,link:'/'+level,constant:null,totalNotes:index,level}))
  ]
  const expected = ['/Lv.18+','/Lv.18','/Lv.17+','/Lv.17','/known']
  assert.deepEqual(sortScoreSidebar(scores,'constant').map(item=>item.link),expected)
  assert.deepEqual(sortScoreSidebar(scores,'constant',true).map(item=>item.link),[...expected].reverse())
})
test('grouped difficulty links include song names in footer navigation', () => {
  const group = sortScoreSidebar(records)[0]
  assert.equal(group.items[0].text, 'Easy')
  assert.equal(group.items[0].docFooterText, 'A · Easy')
  assert.equal(group.items[1].docFooterText, 'A · Hard')
})

test('only matching title and subtitle merge into difficulty groups', () => {
  const records = [
    { title: 'Song', subtitle: 'Author A', difficulty: 'Hard', totalNotes: 200, link: '/a-hard' },
    { title: 'Song', subtitle: 'Author A', difficulty: 'Easy', totalNotes: 100, link: '/a-easy' },
    { title: 'Song', subtitle: 'Author B', difficulty: 'Hard', link: '/b-hard' },
    { title: 'Other Song', subtitle: 'Author A', link: '/other' }
  ]
  const items = sortScoreSidebar(records)
  assert.equal(items.length, 3)
  const group = items.find(item => item.items)
  assert.deepEqual(group.items.map(item => item.link), ['/a-hard', '/a-easy'])
  assert.ok(items.some(item => item.link === '/b-hard'))
})

test('title sorting uses natural numbers and ignores case and character width', () => {
  const records = ['Track 10', 'Track 2', 'Track 1'].map((title, i) => ({ title, link: '/track-' + i }))
  assert.deepEqual(sortScoreSidebar(records).map(item => item.text), ['Track 1', 'Track 2', 'Track 10'])
  assert.deepEqual(sortScoreSidebar(records, 'title', true).map(item => item.text), ['Track 10', 'Track 2', 'Track 1'])
})

test('title ordering places Chinese names after English names', () => {
  const records = ['万吨匿名信', 'Zoo', '风屿', 'Alpha'].map((title, i) => ({ title, link: '/mixed-' + i }))
  const names = sortScoreSidebar(records).map(item => item.text)
  assert.deepEqual(names, ['Alpha', 'Zoo', '风屿', '万吨匿名信'])
  assert.deepEqual(sortScoreSidebar(records, 'title', true).map(item => item.text), [...names].reverse())
})
