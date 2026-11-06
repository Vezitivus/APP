"""End-to-end API checks for 2+, backstage controls and private QR events."""
import importlib.util
import os
import sys
from pathlib import Path
import tempfile

os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(tempfile.mkdtemp()) / 'webtest.db')
os.environ['ADMIN_PIN'] = 'test-only-host-pin'
spec = importlib.util.spec_from_file_location('mk_test_app', Path(__file__).parent / 'app.py')
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name]=module
spec.loader.exec_module(module)
from fastapi.testclient import TestClient

PIN={'X-Admin-Key':'test-only-host-pin'}

def join(client, name):
    r=client.post('/api/join',json={'room':client.get('/api/state').json()['room'],'name':name})
    assert r.status_code == 200, r.text
    return r.json()

def do(client,endpoint,body=None):
    response=client.post('/api/admin/'+endpoint,headers=PIN,json=body or {})
    assert response.status_code==200,(endpoint,response.text)
    return response.json()

def test_min_two_and_many_guests():
    with TestClient(module.app) as client:
        room=client.get('/api/state').json()['room']
        first=join(client,'Dalībnieks 01')
        one=client.post('/api/admin/start',headers=PIN)
        assert one.status_code==409
        # Not capped at 15. Ensure 35 participants can join.
        rest=[join(client,f'Dalībnieks {i:02d}') for i in range(2,36)]
        s=client.get('/api/state').json()
        assert len(s['guests'])==35 and s['minGuests']==2 and 'maxGuests' not in s
        assert 'token' not in str(s) and 'nonce' not in str(s)
        assert client.get('/api/qr/join').status_code==200
        assert client.get('/tv').status_code==200
        assert client.get('/mission/dummy').status_code==200
        do(client,'start')
        # Replace one call discreetly; new guest must differ, old QR dies.
        call=do(client,'call',{'guestId':s['guests'][0]['id'],'kind':'mission'})
        nonce=call['nonce']
        s2=client.get('/api/state').json()
        assert s2['call']['guestId']==s['guests'][0]['id']
        assert 'nonce' not in s2['call']
        new=do(client,'replace')
        assert new['guestId']!=s2['call']['guestId']
        assert client.post('/api/claim',headers={'Authorization':'Bearer '+first['token']},json={'nonce':nonce}).status_code==410
        newest=module.state['call']
        chosen=module.guest(newest['guestId'])
        token=chosen['token']
        other=first['token']
        assert client.post('/api/claim',headers={'Authorization':'Bearer '+other},json={'nonce':newest['nonce']}).status_code==403
        task=client.post('/api/claim',headers={'Authorization':'Bearer '+token},json={'nonce':newest['nonce']})
        assert task.status_code==200 and task.json()['kind']=='mission'
        # Private mission content stays out of TV state.
        assert task.json()['text'] not in str(client.get('/api/state').json())
        # Secret event accessible in separate /mission path and via API with owner ticket.
        assert client.get('/api/mission/'+newest['nonce'],headers={'Authorization':'Bearer '+token}).status_code==200
        assert client.get('/api/mission/'+newest['nonce'],headers={'Authorization':'Bearer '+other}).status_code==404
        skipped=do(client,'skip')
        assert skipped['skipped']=='task'
        assert module.state['events'][-1]['status']=='skipped'
        # Quick next immediately (doesn't wait for scheduled 10-20 minutes)
        newcall=do(client,'rush')
        assert newcall['mode']=='new_call'
        before=module.state['call']['expiresAt']
        rushagain=do(client,'rush')
        assert rushagain['mode']=='shortened'
        assert module.state['call']['expiresAt'] < before
        # Skip the pending call without any visible cancellation modal.
        do(client,'skip')
        assert client.get('/api/state').json()['call'] is None
        assert client.get('/healthz').json()['ok']
        # Start condition also correct after reset.
        do(client,'reset',{'confirm':'RESET'})
        assert len(client.get('/api/state').json()['guests'])==0
        assert client.post('/api/admin/start',headers=PIN).status_code==409


# In an isolated instance, joining exactly two should allow the game to start.
def test_two_players_only():
    module.state.clear()
    module.state.update(module.new_game())
    module.persist()
    with TestClient(module.app) as client:
        join(client,'Anna')
        join(client,'Armands')
        do(client,'start')
        assert client.get('/api/state').json()['phase']=='live'
        call=do(client,'rush')
        assert call['mode']=='new_call'
        do(client,'replace')
        assert module.state['call'] is not None

if __name__=='__main__':
    test_min_two_and_many_guests()
    test_two_players_only()
    print('PASS: min two, 35 guests, private QR, replacement, skip, rush, reset')

def test_custom_activity_and_participants_synchronize_to_public_tv():
    module.state.clear(); module.state.update(module.new_game()); module.persist()
    with TestClient(module.app) as client:
        one=join(client,'Mārcis'); two=join(client,'Roberts'); three=join(client,'Artūrs')
        do(client,'start')
        s=client.get('/api/state').json()
        ids={x['name']: x['id'] for x in s['guests']}
        call=do(client,'call',{'guestId':ids['Mārcis'],'kind':'choice'})
        auth={'Authorization':'Bearer '+one['token']}
        claim=client.post('/api/claim',headers=auth,json={'nonce':call['nonce']})
        assert claim.status_code==200,claim.text
        assert claim.json()['kind']=='choice'
        activity={'nonce':call['nonce'],'activity':'  NHL 26  —   viens periods ', 'participantIds':[ids['Roberts'],ids['Artūrs']]}
        for bad in [dict(activity,participantIds=[]),dict(activity,participantIds=[ids['Mārcis']]),dict(activity,participantIds=[ids['Roberts'],ids['Roberts']]),dict(activity,activity='x'),dict(activity,participantIds=['not-registered'])]:
            r=client.post('/api/activity',headers=auth,json=bad)
            assert r.status_code in (400,422), r.text
        valid=client.post('/api/activity',headers=auth,json=activity)
        assert valid.status_code==200,valid.text
        tv=client.get('/api/state').json()
        assert tv['globalEvent']['text']=='NHL 26 — viens periods'
        assert tv['globalEvent']['participantIds']==[ids['Roberts'],ids['Artūrs']]
        assert 'TU IZLEM NĀKAMO' not in str(tv)
        assert 'token' not in str(tv) and 'nonce' not in str(tv)
        blocked=client.post('/api/activity',headers=auth,json=activity)
        assert blocked.status_code==409
        assert client.post('/api/admin/clear-global').status_code==401
        do(client,'clear-global')
        assert client.get('/api/state').json()['globalEvent'] is None
        # Chosen duel: opponent must be registered, activity is freely entered.
        another=do(client,'call',{'guestId':ids['Mārcis'],'kind':'duel'})
        task=client.post('/api/claim',headers=auth,json={'nonce':another['nonce']})
        assert task.status_code==200
        bad=client.post('/api/duel',headers=auth,json={'nonce':another['nonce'],'opponentId':ids['Mārcis'],'activity':'Boulings'})
        assert bad.status_code==400
        r=client.post('/api/duel',headers=auth,json={'nonce':another['nonce'],'opponentId':ids['Roberts'],'activity':'Šautriņas 301 – uzvar 1.'})
        assert r.status_code==200,r.text
        pub=client.get('/api/state').json()
        assert pub['duel']['activity']=='Šautriņas 301 – uzvar 1.'
        assert pub['duel']['opponentId']==ids['Roberts']
        assert 'discipline' not in pub['duel']
        do(client,'duel-result',{'winnerId':ids['Roberts']})
        # Choice card also lets guest choose a duel and its opponent.
        third=do(client,'call',{'guestId':ids['Artūrs'],'kind':'choice'})
        cl=client.post('/api/claim',headers={'Authorization':'Bearer '+three['token']},json={'nonce':third['nonce']})
        assert cl.status_code==200
        r=client.post('/api/duel',headers={'Authorization':'Bearer '+three['token']},json={'nonce':third['nonce'],'opponentId':ids['Roberts'],'activity':'1 pret 1 NHL'})
        assert r.status_code==200,r.text
        assert client.get('/api/state').json()['duel']['activity']=='1 pret 1 NHL'

if __name__=='__main__':
    test_custom_activity_and_participants_synchronize_to_public_tv()
    print('PASS: custom activities, multiple selected participants, private choice and duel, public TV sync')

def test_rule_cards_and_public_tv_are_distinct():
    module.state.clear();module.state.update(module.new_game());module.persist()
    with TestClient(module.app) as client:
        a=join(client,'Mārcis');b=join(client,'Roberts');c=join(client,'Kristaps')
        do(client,'start')
        people={p['name']:p['id'] for p in client.get('/api/state').json()['guests']}
        owner={'Authorization':'Bearer '+a['token']}
        outsider={'Authorization':'Bearer '+b['token']}
        for kind in ('flash','pair','team'):
            called=do(client,'call',{'kind':kind,'guestId':people['Mārcis']})
            assert client.post('/api/claim',headers=outsider,json={'nonce':called['nonce']}).status_code==403
            event=client.post('/api/claim',headers=owner,json={'nonce':called['nonce']})
            assert event.status_code==200,event.text
            event=event.json()
            assert event['kind']==kind and len(event['rules'])>=3 and event['title']
            public=client.get('/api/state').json()
            assert event['text'] not in str(public), 'Private card appeared on TV too early'
            bad_ids={ 'flash':[people['Roberts']], 'pair':[], 'team':[] }[kind]
            bad=client.post('/api/card/activate',headers=owner,json={'nonce':called['nonce'],'participantIds':bad_ids})
            assert bad.status_code==400, bad.text
            # select only one partner for team: only if min participants allows it
            ids={'flash':[], 'pair':[people['Roberts']], 'team':[people['Roberts'],people['Kristaps']]}[kind]
            okay=client.post('/api/card/activate',headers=owner,json={'nonce':called['nonce'],'participantIds':ids})
            assert okay.status_code==200,okay.text
            tv=client.get('/api/state').json()['globalEvent']
            assert tv['text']==event['text'] and tv['rules']==event['rules']
            assert tv['participantIds']==[people['Mārcis']]+ids
            assert 'nonce' not in str(client.get('/api/state').json())
            assert client.post('/api/card/activate',headers=owner,json={'nonce':called['nonce'],'participantIds':ids}).status_code==409
            do(client,'clear-global')

def test_two_guest_team_card_is_still_playable():
    module.state.clear();module.state.update(module.new_game());module.persist()
    with TestClient(module.app) as client:
        a=join(client,'Anna');join(client,'Bruno');do(client,'start')
        people={p['name']:p['id'] for p in client.get('/api/state').json()['guests']}
        nonce=do(client,'call',{'kind':'team','guestId':people['Anna']})['nonce']
        auth={'Authorization':'Bearer '+a['token']}
        card=client.post('/api/claim',headers=auth,json={'nonce':nonce}).json()
        assert card['minSelections']>=1
        response=client.post('/api/card/activate',headers=auth,json={'nonce':nonce,'participantIds':[people['Bruno']]})
        assert response.status_code==200,response.text