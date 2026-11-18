const prototypeFrame=document.querySelector("#prototype-frame");

if(prototypeFrame){
  prototypeFrame.addEventListener("load",()=>{
    let frameBody=prototypeFrame.contentDocument?.body;
    if(!frameBody) return;

    function resizeFrame(){
      prototypeFrame.style.height=`${frameBody.scrollHeight+8}px`;
    }

    resizeFrame();
    new ResizeObserver(resizeFrame).observe(frameBody);
  });
}
