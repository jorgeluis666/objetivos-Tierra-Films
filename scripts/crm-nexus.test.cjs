const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('CRM view stays isolated and preserves manual feedback',()=>{
 const nodes=new Map(),listeners={};let manualCalls=0;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},attrs:{},dataset:{src:'https://nexus.limaretail.com/crm/embed?slug=tierrafilms'},contentWindow:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this[k]||null},addEventListener(k,f){this[k]=f}});return nodes.get(id)};
 const window={TierraFilmsLeads:{init(){manualCalls++},render(){},detectObjective(){}},addEventListener(k,f){listeners[k]=f}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/crm-nexus.js'),'utf8'),{window,document:{getElementById:get},Number,Math});
 window.TierraFilmsLeads.init(); const frame=get('crm-nexus-frame');
 assert.equal(frame.src,frame.dataset.src);assert.equal(manualCalls,0);assert.equal(get('crm-feedback-panel').hidden,true);
 get('crm-feedback-tab').click();assert.equal(manualCalls,1);assert.equal(get('crm-nexus-panel').hidden,true);
 get('crm-nexus-tab').click();assert.equal(get('crm-feedback-panel').hidden,true);
 const event={origin:'https://evil.example',source:frame.contentWindow,data:{type:'nexus-crm-height',height:900}};
 listeners.message(event);assert.equal(frame.style.height,undefined);
 event.origin='https://nexus.limaretail.com';event.source={};listeners.message(event);assert.equal(frame.style.height,undefined);
 event.source=frame.contentWindow;listeners.message(event);assert.equal(frame.style.height,'924px');
 event.data.height=Infinity;listeners.message(event);assert.equal(frame.style.height,'924px');
});
