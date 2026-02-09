/* =========================
   == DB ==
========================= */
let db=null;
const openDB=()=>new Promise((res,rej)=>{
  const req=indexedDB.open('pr@Ba',3);
  req.onupgradeneeded=e=>{
    db=e.target.result;
    ['product','order','invoice'].forEach(s=>{
      if(!db.objectStoreNames.contains(s))
        db.createObjectStore(s,{keyPath:'id',autoIncrement:true});
    });
  };
  req.onsuccess=e=>res(db=e.target.result);
  req.onerror=e=>rej(e);
});

const add=(s,d)=>new Promise((res,rej)=>{
  const r=db.transaction(s,'readwrite').objectStore(s).add(d);
  r.onsuccess=()=>res(d); r.onerror=e=>rej(e);
});
const put=(s,d)=>new Promise((res,rej)=>{
  const r=db.transaction(s,'readwrite').objectStore(s).put(d);
  r.onsuccess=()=>res(d); r.onerror=e=>rej(e);
});
const del=(s,id)=>new Promise((res,rej)=>{
  const r=db.transaction(s,'readwrite').objectStore(s).delete(id);
  r.onsuccess=()=>res(); r.onerror=e=>rej(e);
});
const clear=s=>new Promise((res,rej)=>{
  const r=db.transaction(s,'readwrite').objectStore(s).clear();
  r.onsuccess=()=>res(); r.onerror=e=>rej(e);
});
const gets=s=>new Promise((res,rej)=>{
  const data=[];
  const r=db.transaction(s).objectStore(s).openCursor();
  r.onsuccess=e=>{
    const c=e.target.result;
    c?(data.push({...c.value,id:c.key}),c.continue()):res(data);
  };
  r.onerror=e=>rej(e);
});

/* =========================
   == SESSION ==
========================= */
const setSession=d=>localStorage.setItem('session',JSON.stringify(d));
const getSession=()=>JSON.parse(localStorage.getItem('session')||'null');
const delSession=()=>localStorage.removeItem('session');

/* =========================
   == UI HELPERS ==
========================= */
const m={
  get(el){
    if(typeof el==='string')
      el=document.querySelector(/^[.#]/.test(el)?el:`#${el}`);
    return el?bootstrap.Modal.getOrCreateInstance(el):null;
  },
  show(el){this.get(el)?.show()},
  hide(el){this.get(el)?.hide()}
};
const $=i=>document.getElementById(i);
const rp=n=>Number(n||0).toLocaleString('id-ID');

const setUpper=el=> el.value=el.value.replace(/\b\w/g,c=>c.toUpperCase());
const setPhone=el=>{
  let v=el.value.replace(/\D/g,'').slice(0,12);
  if(v.length>8) v=v.replace(/(\d{4})(\d{4})(\d+)/,'$1-$2-$3');
  else if(v.length>4) v=v.replace(/(\d{4})(\d+)/,'$1-$2');
  el.value=v;
};

document.querySelectorAll('input[type="text"],textarea')
  .forEach(el=>el.oninput=()=>setUpper(el));
document.querySelectorAll('input[type="tel"]')
  .forEach(el=>el.oninput=()=>setPhone(el));
document.querySelectorAll('input,textarea')
  .forEach(el=>el.onclick=()=>el.select());

const showLoading=()=>Swal.fire({title:'Loading...',allowOutsideClick:false,showConfirmButton:false,didOpen:()=>Swal.showLoading()});
const hideLoading=()=>Swal.close();
const ok=t=>Swal.fire({icon:'success',text:t,showConfirmButton:false,timer:1200});
const err=t=>Swal.fire({icon:'info',text:t,showConfirmButton:false,timer:1200});

/* =========================
   == USER / AUTH ==
========================= */
const btnAddUser = $('addUser');
const btnDelUser = $('delUser');
const user = $('username');
const telp = $('telphone');
const addr = $('address');

btnAddUser.onclick = async ()=>{
  const u = user.value.trim();
  const t = telp.value.trim();
  const a = addr.value.trim();

  if(!u || !t || !a) return err('Silakan isi data dg lengkap');

  const role = u.toLowerCase()==='admin' ? 'admin' : 'user';
  setSession({role,username:u,phone:t,address:a});

  ok(`Login sebagai ${role.toUpperCase()}`);
  m.hide('#formUser');
  m.show('#pageProduct');
  applyRole();
  loadProduct();
  tableOrder();
};

btnDelUser.onclick = async ()=>{
  delSession();
  location.reload();
};

/* =========================
   == STATE ==
========================= */
let imgData = null;
let editId  = null;

/* =========================
   == ELEMENT ==
========================= */
const pdc  = $('pdc');
const prc  = $('prc');
const stk  = $('stk');
const pic  = $('pic');
const vew  = $('vew');
const dels = $('del');
const enter= $('enter');
const table= $('tableOrder');
const btnAddProduct = $('btnAddProduct');
const btnInv= $('btnInv');

/* =========================
   == API ==
========================= */
const getProduct = () => gets('product');
const addProduct = dt => add('product', dt);
const setProduct = dt => put('product', dt);
const delProduct = id => del('product', id);

const getOrder = () => gets('order');
const addOrder = dt => add('order', dt);
const setOrder = dt => put('order', dt);
const delOrder = id => del('order', id);
const removeAll = () => clear('order');

const getInvoice = () => gets('invoice');
const addInvoice = dt => add('invoice', dt);
const delInvoice = id => del('invoice', id);

/* =========================
   == ROLE APPLY ==
========================= */
function applyRole(){
  const s = getSession();
  const isAdmin = s?.role === 'admin';

  btnAddProduct.classList.toggle('d-none', !isAdmin);

  if(isAdmin){
    enter.classList.add('d-none');
    table.innerHTML = '';
  }
}

/* =========================
   == IMAGE PREVIEW ==
========================= */
function viewPicture(input){
  const f = input.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    imgData = r.result;
    vew.src = imgData;
    vew.classList.remove('d-none');
  };
  r.readAsDataURL(f);
}

/* =========================
   == SAVE PRODUCT (ADMIN ONLY) ==
========================= */
async function saveProduct(){
  const s = getSession();
  if(s?.role!=='admin') return err('Akses ditolak');

  const name  = pdc.value.trim();
  const price = +prc.value;
  const stock = +stk.value;

  if(!name || price<=0 || stock<0) return err('Data belum lengkap');

  const data = {
    pdc: name,
    prc: price,
    stk: stock,
    img: imgData || vew.src || ''
  };

  if(editId){
    data.id = editId;
    await setProduct(data);
    ok('Produk diperbarui');
  }else{
    await addProduct(data);
    ok('Produk ditambahkan');
  }

  resetForm();
  loadProduct();
  m.hide('#formProduct');
  m.show('#pageProduct');
}

/* =========================
   == RESET FORM ==
========================= */
function resetForm(){
  editId = null;
  imgData = null;
  pdc.value = prc.value = stk.value = '';
  pic.value = '';
  vew.src = '';
  vew.classList.add('d-none');
  dels.classList.add('d-none');
}

/* =========================
   == LOAD PRODUCT ==
========================= */
async function loadProduct(){
  const el = $('loadProduct');
  if(!el) return;

  const product = await getProduct();
  const s = getSession();
  const isAdmin = s?.role === 'admin';

  if(!product.length){
    el.innerHTML = `<div class="alert alert-warning text-center">Produk belum tersedia</div>`;
    return;
  }

  el.innerHTML = product.map(p => `
    <div class="d-flex justify-content-between align-items-center bg-success-subtle my-2 p-2 rounded">
      <img src="${p.img||''}" style="object-fit:cover;width:120px;height:90px;border-radius:.5rem"/>
      <div class="d-flex flex-column text-center w-50">
        <p class="fw-bolder m-0">${p.pdc}</p>
        <p class="m-0">Harga: Rp ${rp(p.prc)}</p>
        <p class="m-0">Stock: ${p.stk}</p>
        <div class="d-flex justify-content-around">
          <span class="badge ${isAdmin?'':'d-none'} ${p.stk<=0?'bg-danger':'bg-warning'} pointer"
                onclick="editProduct(${p.id})">
            ${p.stk<=0?'Stock Habis':'Update'}
          </span>
          ${!isAdmin ? `
          <span class="badge ${p.stk<=0?'bg-warning text-dark':'bg-success'} pointer"
                onclick="${p.stk>0?`enterOrder(${p.id})`:''}">
            ${p.stk<=0?'Product sedang disiapkan..':'Order'}
          </span>` : ``}
        </div>
      </div>
    </div>
  `).join('');
  
  btnInv.textContent= `${isAdmin ? 'Invoice' : 'Riwayat Transaksi'}`;
}

/* =========================
   == EDIT PRODUCT ==
========================= */
async function editProduct(id){
  const s = getSession();
  if(s?.role!=='admin') return err('Akses ditolak');

  const product = await getProduct();
  const p = product.find(x=>x.id===id);
  if(!p) return;

  editId = id;
  imgData = null;

  pdc.value = p.pdc;
  prc.value = p.prc;
  stk.value = p.stk;

  if(p.img){
    vew.src = p.img;
    vew.classList.remove('d-none');
  }

  dels.onclick = async ()=>{
    const c = await Swal.fire({
      icon:'warning',
      text:'Hapus produk?',
      showCancelButton:true,
      confirmButtonText:'Ya'
    });
    if(!c.isConfirmed) return;

    await delProduct(id);
    ok('Produk dihapus');
    resetForm();
    m.hide('#formProduct');
    loadProduct();
  };

  dels.classList.remove('d-none');
  m.show('#formProduct');
}

/* =========================
   == INPUT ORDER ==
========================= */
async function enterOrder(id){
  const s = getSession();
  if(s?.role!=='user') return err('Hanya user yang dapat order');

  const product = await getProduct();
  const order   = await getOrder();

  const pr = product.find(x=>x.id===id);
  if(!pr || pr.stk<=0) return err('Dalam proses menyiapkan Produk');

  const or = order.find(x=>x.productId===id);

  if(or){
    if(or.qty>=pr.stk) return err('Pesanan melebihi stok!');
    or.qty++;
    await setOrder(or);
  }else{
    await addOrder({productId:id,pdc:pr.pdc,prc:pr.prc,qty:1});
  }

  ok('Masuk cart');
  loadProduct();
  tableOrder();
}

/* =========================
   == TABLE ORDER ==
========================= */
async function tableOrder(){
  const s = getSession();
  if(s?.role!=='user'){
    table.innerHTML='';
    enter.classList.add('d-none');
    return;
  }

  const el = $('tableOrder');
  el.innerHTML = '';

  const order = await getOrder();
  if(!order.length){
    enter.classList.add('d-none');
    return;
  }

  let total=0,no=1;

  el.innerHTML = `
  <table class="tableOrder">
    <thead>
      <tr>
        <th rowspan="2">No</th>
        <th rowspan="2">Produk</th>
        <th rowspan="2">Jml</th>
        <th colspan="2">Harga</th>
      </tr>
      <tr>
        <th>Satuan</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${order.map(v=>{
        const sub=v.prc*v.qty; total+=sub;
        return `
        <tr data-id="${v.id}">
          <td>${no++}</td>
          <td>${v.pdc}</td>
          <td class="pointer fw-bolder">${v.qty}</td>
          <td>${rp(v.prc)}</td>
          <td>${rp(sub)}</td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <th colspan="3">TOTAL</th>
        <th colspan="2">Rp ${rp(total)}</th>
      </tr>
    </tfoot>
  </table>`;

  el.querySelectorAll('tbody tr').forEach(tr=>{
    tr.onclick = async ()=>{
      const id = +tr.dataset.id;
      const order = await getOrder();
      const or = order.find(x=>x.id===id);
      if(!or) return;

      const r = await Swal.fire({
        title:or.pdc,
        text:'Pilih aksi',
        icon:'question',
        showCancelButton:true,
        confirmButtonText:'Edit Jml Product',
        cancelButtonText:'Hapus',
        reverseButtons:true
      });

      if(r.isConfirmed){
        const {value:qty} = await Swal.fire({
          title:'Ubah Jumlah Product',
          input:'number',
          inputValue:or.qty,
          inputAttributes:{min:1},
          showCancelButton:true,
          inputValidator:v=>!v||v<1?'Qty minimal 1':null
        });
        if(!qty) return;

        const product = await getProduct();
        const pr = product.find(p=>p.id===or.productId);
        if(qty>pr.stk) return err('Stock tidak cukup');

        or.qty = +qty;
        await setOrder(or);
        tableOrder();
      }

      if(r.dismiss===Swal.DismissReason.cancel){
        const c = await Swal.fire({
          icon:'warning',
          text:'Yakin hapus item?',
          showCancelButton:true,
          confirmButtonText:'Ya, hapus'
        });
        if(!c.isConfirmed) return;
        await delOrder(id);
        tableOrder();
      }
    };
  });

  enter.classList.remove('d-none');
  enter.onclick = makeInvoice;
}

/* =========================
   == CHECKOUT ==
========================= */
async function tableOrder(){
  const s = getSession();
  if(s?.role!=='user'){
    table.innerHTML='';
    enter.classList.add('d-none');
    return;
  }

  const el = $('tableOrder');
  el.innerHTML = '';

  const order = await getOrder();
  if(!order.length){
    enter.classList.add('d-none');
    return;
  }

  let total=0,no=1;

  el.innerHTML = `
  <div class="px-2" style="font-size:.75rem">
    <div class="row">
      <div class="col-3">Nama</div>
      <div class="col-1">:</div>
      <div class="col-8 fw-bolder">${s.username}</div>
    </div>
    <div class="row">
      <div class="col-3">Phone</div>
      <div class="col-1">:</div>
      <div class="col-8">${s.phone}</div>
    </div>
    <div class="row">
      <div class="col-3">Alamat</div>
      <div class="col-1">:</div>
      <div class="col-8">${s.address}</div>
    </div>
  </div>
  <table class="tableOrder">
    <thead>
      <tr>
        <th rowspan="2">No</th>
        <th rowspan="2">Produk</th>
        <th rowspan="2">Jml</th>
        <th colspan="2">Harga</th>
      </tr>
      <tr>
        <th>Satuan</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${order.map(v=>{
        const sub=v.prc*v.qty; total+=sub;
        return `
        <tr data-id="${v.id}">
          <td>${no++}</td>
          <td>${v.pdc}</td>
          <td class="pointer fw-bolder">${v.qty}</td>
          <td>${rp(v.prc)}</td>
          <td>${rp(sub)}</td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <th colspan="3">TOTAL</th>
        <th colspan="2">Rp ${rp(total)}</th>
      </tr>
    </tfoot>
  </table>`;

  /* klik row → edit qty / remove */
  el.querySelectorAll('tbody tr').forEach(tr=>{
    tr.onclick = async ()=>{
      const id = +tr.dataset.id;
      const order = await getOrder();
      const or = order.find(x=>x.id===id);
      if(!or) return;

      const r = await Swal.fire({
        title:or.pdc,
        text:'Pilih aksi',
        icon:'question',
        showCancelButton:true,
        confirmButtonText:'Edit Jml Product',
        cancelButtonText:'Hapus',
        reverseButtons:true
      });

      /* EDIT QTY */
      if(r.isConfirmed){
        const {value:qty} = await Swal.fire({
          title:'Ubah Jumlah Product',
          input:'number',
          inputValue:or.qty,
          inputAttributes:{min:1},
          showCancelButton:true,
          inputValidator:v=>!v||v<1?'Qty minimal 1':null
        });
        if(!qty) return;

        const product = await getProduct();
        const pr = product.find(p=>p.id===or.productId);
        if(qty>pr.stk) return err('Stock tidak cukup');

        or.qty = +qty;
        await setOrder(or);
        tableOrder();
      }

      /* DELETE */
      if(r.dismiss===Swal.DismissReason.cancel){
        const c = await Swal.fire({
          icon:'warning',
          text:'Yakin hapus item?',
          showCancelButton:true,
          confirmButtonText:'Ya, hapus'
        });
        if(!c.isConfirmed) return;
        await delOrder(id);
        tableOrder();
      }
    };
  });

  enter.classList.remove('d-none');
  enter.onclick = makeInvoice;
}

/* == CHECKOUT (USER ONLY) == */
async function makeInvoice(){
  const s = getSession();
  if(s?.role!=='user') return err('Hanya user yang dapat checkout');

  const order = await getOrder();
  if(!order.length) return err('Cart masih kosong');

  const c = await Swal.fire({
    icon:'question',
    title:'Checkout?',
    text:'Lanjutkan pesanan ini?',
    showCancelButton:true,
    confirmButtonText:'Ya'
  });
  if(!c.isConfirmed) return;

  showLoading();
  enter.classList.add('d-none');

  /* === UPDATE STOCK === */
  const product = await getProduct();
  for(const v of order){
    const p = product.find(x=>x.id===v.productId);
    if(!p) continue;
    p.stk = Math.max(0, p.stk - v.qty);
    await setProduct(p);
  }

  /* === CAPTURE INVOICE === */
  const canvas = await html2canvas(table,{scale:1});
  const img = canvas.toDataURL('image/png');
  const timestamp = new Date().toLocaleString('id-ID',{weekday:'long',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'
  });

  await addInvoice({timestamp,img});
  await removeAll();
  
  table.innerHTML='';
  hideLoading();
  ok('Checkout berhasil!');
  loadProduct();
  loadInvoice();
  m.show('#invoice');
}

/* == LOAD INVOICE == */
async function loadInvoice(){
  const el = $('loadInvoice');
  el.innerHTML = '';

  const inv = await getInvoice();
  if(!inv.length) return;

  const s = getSession();
  const isAdmin = s?.role === 'admin';

  el.innerHTML = inv.reverse().map(v=>`
    <div class="card mb-2 px-1 position-relative">
      <img src="${v.img}" class="img-fluid my-2 pointer w-auto" onclick="viewInvoice('${v.img}')">
      ${isAdmin ? `<span class="badge bg-danger pointer position-absolute top-0 end-0 m-1" data-id="${v.id}">Hapus</span>` : ``}
    </div>
  `).join('');

  if(isAdmin){
    el.querySelectorAll('[data-id]').forEach(b=>{
      b.onclick = async ()=>{
        const id = +b.dataset.id;
        const c = await Swal.fire({
          icon:'warning',
          text:'Hapus invoice ini?',
          showCancelButton:true
        });
        if(!c.isConfirmed) return;
        await delInvoice(id);
        ok('Invoice dihapus');
        loadInvoice();
      };
    });
  }
}

function viewInvoice(src){
  Swal.fire({
    imageUrl: src,
    showConfirmButton:false,
    background:'transparent',
    padding:0
  });
}

/* =========================
   == INIT ==
========================= */
(async()=>{
  await openDB();
  const s = getSession();
  if(!s){
    m.show('#formUser');
    return;
  }
  m.show('#pageProduct');
  applyRole();
  loadProduct();
  loadInvoice();
  tableOrder();
})();