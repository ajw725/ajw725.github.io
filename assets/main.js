// Static comments
// from: https://github.com/eduardoboucas/popcorn/blob/gh-pages/js/main.js 
var form = document.querySelector('.js-comment-form');
var submitBtn = document.getElementById('comment-form-submit');
var successMsg = document.getElementById('success-message');

form.addEventListener('submit', function(e) {
  e.preventDefault();

  submitBtn.setAttribute('disabled', 'disabled');
  submitBtn.textContent = 'Please wait...';

  var payload = {};
  var formData = new FormData(form);
  for(var [k, v] of formData) {
    if(k.includes('[')) {
      var obj = payload;
      var keyParts = k.split(/\[|\]/).filter(function(x) { return !!x })
      var depth = keyParts.length;
      keyParts.forEach(function(keyPart, idx) {
        if(idx === depth - 1) {
          obj[keyPart] = v;
        } else {
          if(!obj[keyPart]) {
            obj[keyPart] = {};
          }
          obj = obj[keyPart];
        }
      });
    } else {
      payload[k] = v;
    }
  }

  fetch(form.action, {
    method: form.method.toUpperCase(),
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).then(function(resp) {
    return resp.json();
  }).then(function(data) {
    if(data.success) {
      successMsg.classList.remove('hide');
      form.reset();
    } else {
      console.error(data.errorCode, data.message);
      alert("An error occured submitting the comment. If you know what you're doing, feel free to check the console for error details.");
    }
  }).catch(function(err) {
    console.error(err);
    alert("An error occured submitting the comment. If you know what you're doing, feel free to check the console for error details.");
  }).finally(function() {
    submitBtn.removeAttribute('disabled');
    submitBtn.textContent = 'Submit';
    if(typeof(grecaptcha) !== undefined) {
      grecaptcha.reset();
    }
  });
});

document.getElementById('close-message').addEventListener('click', function() {
  successMsg.classList.add('hide');
});

// Staticman comment replies, from https://github.com/mmistakes/made-mistakes-jekyll
// modified from Wordpress https://core.svn.wordpress.org/trunk/wp-includes/js/comment-reply.js
// Released under the GNU General Public License - https://wordpress.org/about/gpl/
// addComment.moveForm is called from comment.html when the reply link is clicked.
var addComment = {
  moveForm: function( commId, parentId, respondId, postId ) {
    var div, element, style, cssHidden,
    t           = this,                    //t is the addComment object, with functions moveForm and I, and variable respondId
    comm        = t.I( commId ),                                //whole comment
    respond     = t.I( respondId ),                             //whole new comment form
    cancel      = t.I( 'cancel-comment-reply-link' ),           //whole reply cancel link
    parent      = t.I( 'comment-replying-to' ),                 //a hidden element in the comment
    post        = t.I( 'comment-post-slug' ),                   //null
    commentForm = respond.getElementsByTagName( 'form' )[0];    //the <form> part of the comment_form div
    
    if ( ! comm || ! respond || ! cancel || ! parent || ! commentForm ) {
      return;
    }
    
    t.respondId = respondId;
    postId = postId || false;
    
    if ( ! t.I( 'sm-temp-form-div' ) ) {
      div = document.createElement( 'div' );
      div.id = 'sm-temp-form-div';
      div.style.display = 'none';
      respond.parentNode.insertBefore( div, respond ); //create and insert a bookmark div right before comment form
    }
    
    comm.parentNode.insertBefore( respond, comm.nextSibling );  //move the form from the bottom to above the next sibling
    if ( post && postId ) {
      post.value = postId;
    }
    parent.value = parentId;
    cancel.style.display = '';                        //make the cancel link visible
    
    cancel.onclick = function() {
      var t       = addComment,
      temp    = t.I( 'sm-temp-form-div' ),            //temp is the original bookmark
      respond = t.I( t.respondId );                   //respond is the comment form
      
      if ( ! temp || ! respond ) {
        return;
      }
      
      t.I( 'comment-replying-to' ).value = null;      //forget the name of the comment
      temp.parentNode.insertBefore( respond, temp );  //move the comment form to its original location
      temp.parentNode.removeChild( temp );            //remove the bookmark div
      this.style.display = 'none';                    //make the cancel link invisible
      this.onclick = null;                            //retire the onclick handler
      return false;
    };
    
    /*
    * Set initial focus to the first form focusable element.
    * Try/catch used just to avoid errors in IE 7- which return visibility
    * 'inherit' when the visibility value is inherited from an ancestor.
    */
    try {
      for ( var i = 0; i < commentForm.elements.length; i++ ) {
        element = commentForm.elements[i];
        cssHidden = false;
        
        // Modern browsers.
        if ( 'getComputedStyle' in window ) {
          style = window.getComputedStyle( element );
          // IE 8.
        } else if ( document.documentElement.currentStyle ) {
          style = element.currentStyle;
        }
        
        /*
        * For display none, do the same thing jQuery does. For visibility,
        * check the element computed style since browsers are already doing
        * the job for us. In fact, the visibility computed style is the actual
        * computed value and already takes into account the element ancestors.
        */
        if ( ( element.offsetWidth <= 0 && element.offsetHeight <= 0 ) || style.visibility === 'hidden' ) {
          cssHidden = true;
        }
        
        // Skip form elements that are hidden or disabled.
        if ( 'hidden' === element.type || element.disabled || cssHidden ) {
          continue;
        }
        
        element.focus();
        // Stop after the first focusable element.
        break;
      }
      
    } catch( er ) {}
    
    return false;
  },
  
  I: function( id ) {
    return document.getElementById( id );
  }
};